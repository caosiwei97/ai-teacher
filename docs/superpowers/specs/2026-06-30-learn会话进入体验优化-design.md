# /learn 会话进入体验优化 — Design Spec

> 日期：2026-06-30
> 主题：从 /learn 选卡片到 /learn/:id 的进入过渡不丝滑，优化为真位移下沉 + 消除空态闪烁 + 首条消息格式化 + 输入框 icon 避让
> 类型：产品需求（UI 行为优化）
> 关联文件：`apps/web/src/pages/learn.tsx`、`apps/web/src/components/chat/chat-input.tsx`

---

## 1. 问题背景

当前从 `/learn`（引导态 LandingView）选择推荐卡片或输入消息后，跳转到 `/learn/:id`（聊天态 ChatView）体验不丝滑，具体 4 个根因：

| #   | 根因                        | 代码位置                                                                                                              | 现象                                                                                             |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | 下沉是跨组件淡出+淡入伪过渡 | `learn.tsx:103`（LandingView 整页 `opacity-0 translate-y-4` 淡出）→ `navigate` → ChatView 重新挂载，输入框底部淡入    | 输入框不是"同一框下滑"，而是整页消失再出现，断裂感强                                             |
| 2   | 进入后有空态废话闪烁        | `chat-area.tsx:185-192` 默认 fallback「开始你的学习之旅吧」；`learn.tsx:1092-1094` isNewSession 时不传 welcomeContent | 进入 ChatView 后短暂显示"开始你的学习之旅吧"，等 firstMessage effect 触发 submitMessage 后才消失 |
| 3   | 首条消息是原文              | `learn.tsx:77-94` sendMessage 传 `trimmed` 原文                                                                       | 点"个人投资理财入门"卡片，消息显示原文，而非期望的"请教我学习《个人投资理财入门》"               |
| 4   | 输入框文字挡 icon           | `chat-input.tsx:88` textarea 仅 `pr-12`（48px），icon 区 `absolute bottom-2 right-2` 实际宽 ~200px                    | 多行输入时文字延伸到 icon 区被遮挡                                                               |

---

## 2. 目标体验

用户从 `/learn` 点击「个人投资理财入门」卡片后：

1. 输入框作为**同一 DOM 元素**从居中位置平滑下滑到页面底部（真位移，非淡出淡入）
2. 下滑过程中/完成后，页面展示对话「请教我学习《个人投资理财入门》」
3. 紧接着展示 loading 效果（复用现有「老师正在思考中…」脉冲点），**不显示**「开始你的学习之旅吧」空态
4. 进入 `/learn/:id` 后聊天组件与 `/learn` 一致：有模式选择、输入内容、文件上传、模型选择；额外有推荐回答（Lightbulb）icon

---

## 3. 设计方案

### 3.1 单元 A — 下沉动画（View Transitions API 真位移）

**原理**：View Transitions API 允许给 DOM 元素标记 `view-transition-name`，浏览器在路由切换（DOM 快照新旧两份）时对同 name 元素自动做位置/尺寸插值。LandingView 的输入框（居中）与 ChatView 的输入框（底部）标记同一 name，浏览器自动算位移路径并动画。

**改动**：

1. **ChatInput 最外层 div**（`chat-input.tsx:67`）加 inline style：

   ```tsx
   <div
     className={frameless ? "" : "border-t border-border p-5"}
     style={{ viewTransitionName: "chat-input-shell" }}
   >
   ```

   `view-transition-name` 在落地页（frameless）和聊天页（非 frameless）都生效，使两者输入框被识别为同一元素。

2. **LandingView.sendMessage**（`learn.tsx:77-94`）用 `document.startViewTransition` 包裹 navigate：

   ```tsx
   async function sendMessage(text: string) {
     const trimmed = text.trim();
     if (!trimmed || creating) return;
     setCreating(true);
     try {
       const newSession = await createSession(
         USER_ID,
         "未命名对话",
         teachingMode,
       );
       setSessions((prev) => [newSession, ...prev]);
       const target = `/learn/${newSession.id}`;
       const navigateOpts = {
         state: { firstMessage: formatted, teachingMode },
         replace: true,
       };
       if (document.startViewTransition) {
         const t = document.startViewTransition(() =>
           navigate(target, navigateOpts),
         );
         t.finished.finally(() => setCreating(false));
       } else {
         navigate(target, navigateOpts);
         setCreating(false);
       }
     } catch (err) {
       console.error("Failed to create session:", err);
       setCreating(false);
     }
   }
   ```

   - 移除原 `leaving` state 及整页 `opacity-0 translate-y-4` 淡出（`learn.tsx:56,81,103`）
   - 移除 `transition-all duration-500` 类（VT API 接管动画）

3. **降级**：`document.startViewTransition` 不存在（旧浏览器）时直接 `navigate`，无动画但功能正常。

**注意**：VT API 默认对同 name 元素做 cross-fade + 位移。由于两个输入框尺寸/外观一致（同一 ChatInput 组件），位移是主要视觉效果，符合"下沉"语义。无需自定义 `::view-transition-old/new` 动画（默认已足够）。

### 3.2 单元 B — 消除空态闪烁（首条消息预置）

**问题**：`handleSubmit`（`use-chat-stream.ts:80-100`）会自己 push user + assistant 消息（`[...messages, userMessage, assistantMessage]`），基于闭包 `messages`。若先乐观插入 user 消息再调 `submitMessage`，存在时序竞态：setState 异步，闭包可能拿旧 messages → 重复 user 消息。

**方案**：不乐观插入消息，改为**让 ChatArea 在「首条消息待发送」期间不渲染空态 fallback**。

改动 `learn.tsx`：

1. 新增 state `pendingFirstMessage: boolean`，初值 = `!!firstMessage`（来自 location.state）。

2. ChatArea 的空态渲染由 `pendingFirstMessage` 抑制：在 `chatAreaProps` 传入一个临时 `welcomeContent`，当 `isNewSession && pendingFirstMessage` 时传一个"正在发送…"占位节点（而非 null，避免触发 fallback）；消息出现后 `pendingFirstMessage` 置 false。

   具体：`learn.tsx` 中 isNewSession 分支改为：

   ```tsx
   <ChatArea
     {...chatAreaProps}
     welcomeContent={pendingFirstMessage ? <FirstMessagePending /> : undefined}
   />
   ```

   其中 `<FirstMessagePending />` 是一个极简占位（如居中的脉冲点 + "正在发送…"），视觉上与后续 loading 衔接。消息出现后 messages.length > 0，welcomeContent 不再渲染，pendingFirstMessage 置 false。

3. firstMessage effect（`learn.tsx:792-797`）保持：检测到 isNewSession && firstMessage && !isLoading && messages.length === 0 时调 `submitMessage(firstMessage)`。submitMessage 触发后 messages 立即非空（handleSubmit 同步 setMessages），pendingFirstMessage 在下一个 effect 周期置 false。

**为何不乐观插入**：避免与 handleSubmit 的消息追加逻辑冲突（去重复杂、时序脆弱）。用 welcomeContent 占位更简单可靠，且 ChatArea 已支持 welcomeContent 渲染分支。

### 3.3 单元 C — 首条消息格式化

`LandingView.sendMessage`（`learn.tsx:77`）内统一包装：

```tsx
async function sendMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed || creating) return;
  // 统一包装为「请教我学习《》」，已含书名号或已是完整句则不重复包装
  const formatted = /《.+》/.test(trimmed) || /^(请教|请教我|学习)/.test(trimmed)
    ? trimmed
    : `请教我学习《${trimmed}》`;
  ...
  navigate(`/learn/${newSession.id}`, {
    state: { firstMessage: formatted, teachingMode },
    replace: true,
  });
}
```

- 手输和卡片点击都走 sendMessage，统一包装
- 去重：已含 `《》` 或以"请教/学习"开头则不重复包装，避免「请教我学习《请教我学习《个人投资理财入门》》」
- 后续用户在 ChatView 内手输消息走 `handleSubmit`（learn.tsx:661），不包装，保持原文

### 3.4 单元 D — 输入框文字不挡 icon

**问题**：`chat-input.tsx:88` textarea `px-4 py-4 pr-12`，icon 区 `absolute bottom-2 right-2`（距底 8px + icon 高 40px = 占底部 48px，宽度 ~200px）。多行时文字延伸进 icon 区。

**改动**：textarea padding 由 `px-4 py-4 pr-12` 改为 `px-4 pt-4 pb-12 pr-12`：

```tsx
className =
  "flex-1 resize-none bg-transparent px-4 pt-4 pb-12 pr-12 text-[16px] leading-relaxed ...";
```

- `pb-12`（48px）：多行时最后一行停在 icon 区上方，不被遮挡
- `pr-12`（48px）：单行时右侧避让发送按钮（发送按钮在最右，宽 40px + right-2 8px = 48px，正好）
- 单行场景视觉不变（pt-4 + 一行文字 + pb-12，textarea min-height 56px 由 `minHeight` style 兜底，实际高度自适应）

**验证**：输入 5+ 行文字，确认最后一行不被回形针/模型/suggest/发送 icon 遮挡；单行时输入框高度无异常跳变。

---

## 4. 涉及文件

| 文件                                          | 改动单元 | 改动内容                                                                               |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `apps/web/src/pages/learn.tsx`                | A/B/C    | VT API 包裹 navigate、移除 leaving 淡出、新增 pendingFirstMessage 占位、首条消息格式化 |
| `apps/web/src/components/chat/chat-input.tsx` | A/D      | 最外层 div 加 `viewTransitionName`、textarea padding `pb-12`                           |

---

## 5. 不改动的部分

- ChatArea 的 loading 脉冲点逻辑（复用现有，`chat-area.tsx:222-255`）
- suggest-reply Lightbulb icon（复用现有，进入 /learn/:id 已通过 `onSuggest` 传入）
- 路由结构（`/learn` 与 `/learn/:id` 仍共用 learn.tsx 壳组件）
- `use-chat-stream.ts`（不动 handleSubmit/submitMessage 逻辑）
- 后端（不动）

---

## 6. 风险与边界

1. **VT API 兼容性**：Chromium 124+ / Safari 18+ 支持。降级路径完备（`if (!document.startViewTransition)` 直接 navigate）。单元 B 已消除空态，故降级后虽无动画但无闪烁，体验可接受。开发日志曾记录"跨组件无法同 DOM 位移"——VT API 下此限制不再成立。

2. **VT API 与 React 18 并发模式**：`document.startViewTransition` 的回调内执行 `navigate`（同步触发 React state 更新），React 会在回调返回后 flush DOM，VT API 捕获新旧快照。此模式在 React 18+ 与 VT API 兼容（社区已验证）。若发现快照捕获异常（动画不触发），降级为直接 navigate。

3. **pendingFirstMessage 时序**：submitMessage 触发后 handleSubmit 同步 setMessages（user+assistant），messages.length 立即 > 0，ChatArea 不再渲染 welcomeContent。pendingFirstMessage 在 effect 中置 false，无视觉残留。极端情况（submitMessage 失败）由现有 onError 兜底，pendingFirstMessage 仍会因 messages 为空而保留占位——需在 onError 时也置 false，改为显示 error。

4. **格式化去重**：正则 `/《.+》/` 检测已含书名号，`/^(请教|请教我|学习)/` 检测已以学习请求开头，二者满足其一则不包装。覆盖手输"请教我学习《个人投资理财入门》"和"我想学理财"（后者会被包装为"请教我学习《我想学理财》"，语义可接受）。

5. **textarea 高度**：`pb-12` 后单行 textarea 实际高度 = pt-4(16) + 行高(~26) + pb-12(48) = ~90px，大于 `minHeight: 56px`，故单行时会比现在高。**需验证视觉**：若单行过高不美观，改为 `pb-10`（40px，icon 40px 正好覆盖，底部 8px 间隙由 icon 区自身 `bottom-2` 提供）。

---

## 7. 验收标准

- [ ] 从 `/learn` 点「个人投资理财入门」卡片，输入框平滑下滑到底部（VT API 生效，非整页淡出）
- [ ] 下滑后页面显示「请教我学习《个人投资理财入门》」用户消息
- [ ] 紧接显示「老师正在思考中…」脉冲点 loading
- [ ] 全程不出现「开始你的学习之旅吧」空态
- [ ] 进入 `/learn/:id` 后输入框有：模式选择、文件上传、模型选择、推荐回答(Lightbulb) icon
- [ ] 在输入框输入 5+ 行文字，最后一行不被 icon 遮挡
- [ ] 手输"请教我学习《XXX》"不会重复包装
- [ ] 旧浏览器（无 VT API）降级：无动画但无闪烁，功能正常

---

## 8. 门控与文档同步

- **门控**：typecheck(5包) / build / lint(0err) / E2E（home.spec、learn.spec 检查不回归）
- **E2E 影响**：home.spec 涉及首屏文案/卡片点击流程，可能需调整断言（首条消息文案变化、空态文案不再出现）
- **文档同步**：本变更属 UI 行为优化，按 `文档同步规则.md` 评估——不涉及 API/架构/数据模型变更，无需同步 API接口.md/技术架构.md。开发日志记录本次改动。
