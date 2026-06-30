# Agent Loop 体验与健壮性 — 设计文档

> 日期：2026-06-30
> 来源：产品体验发现的 7 个问题，按依赖分 3 组推进
> 状态：待实施

---

## 背景与问题清单

产品体验后发现 7 个问题，根因与现状缺口已通过代码探查定位：

| #   | 问题                                                                        | 类型 | 根因/缺口                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | result 接口报错 `Cannot read properties of undefined (reading 'findFirst')` | Bug  | `InterviewResult` model 新增但 dev/start 脚本未跑 `db:generate`，`globalThis.prisma` 单例缓存旧 client，`prisma.interviewResult` 为 undefined                                    |
| 6   | 诊断完成后提示"路线图已生成"但未渲染                                        | Bug  | `learn.tsx:1036` 收到 generateRoadmap tool-result 时无条件置 `roadmapGenerated=true`，未校验 `result.success` / `roadmapUpdate.nodes`，工具失败仍显示"已生成"但 nodes 为空不渲染 |
| 2   | agent loop 缺 failover，模型挂了无容错                                      | 迭代 | `executeWithRetry` + `getFallbackProvider` 基础设施已建好但未接线；主 loop 无重试/无 try-catch/无降级                                                                            |
| 4   | loop 缺循环检测                                                             | 迭代 | 完全没有；仅 mock provider 有防重                                                                                                                                                |
| 3   | 模型回答过程中切换的处理                                                    | 迭代 | 流式期间 UI 可点但只改 state，不影响进行中的流；前端 stop() 不通知 worker，job 继续跑完                                                                                          |
| 1   | loop 过程展示不了思考/工具/规划/耗时                                        | 迭代 | reasoning 完全丢弃；无 step 边界/耗时事件；tool-call annotation 存了但无 UI 渲染；SSE 事件散写无统一协议                                                                         |
| 5   | 缺模型上下文展示，token 使用占比                                            | 迭代 | `onFinish`/`usage` 未用；ContextManager 算出 tokenCount 但不下发；DB 无 token 字段；前端无 UI                                                                                    |

## 拆解与依赖关系

按依赖分 3 组，每组 1 个 spec 章节但共享本文档：

```
第 1 组：两个 Bug 立即修（#7 #6）           ← 独立、风险低、快速见效
第 2 组：Agent Loop 健壮性迭代（#2 #4 #3）  ← 都改 run-agent-loop.ts，强相关
第 3 组：过程可视化 + Token + 互动优化（#1 #5 #6体验）
```

依赖：第 3 组的过程可视化需要第 2 组的 SSE 协议统一（§2.1）；failover 降级轨迹（§2.3）和循环检测提示（§2.4）的过程展示也依赖第 3 组的过程面板。因此**实施顺序为 第 1 组 → 第 2 组（含 §2.1 协议统一）→ 第 3 组**。

## 关键技术约束（已验证）

- **token 展示是 provider 无关的**：ai SDK 的 `LanguageModelUsage` 是所有 provider 共用类型，`streamText` 的 `onFinish` 回调统一读 `result.usage`/`result.totalUsage`，与选什么模型解耦
- **system/tools token 无法真实拆分**：所有 provider 的 API 都把 system+messages+tools 算进 inputTokens 总量，不拆分。这两项必须用 `estimateTokens`（`context.ts:54-66`）估算，明确标注"估算"
- **BullMQ 第 3 参数 signal 不能用于业务取消**：只在 worker.close()/stalled 时触发。前端 stop→worker 终止须自建 control channel
- **DeepSeek usage 转换已验证**：`inputTokens.cacheRead`=prompt_cache_hit_tokens（已填充），`prompt_cache_miss_tokens` 透传到 `providerMetadata.deepseek.promptCacheMissTokens`，`outputTokens.reasoning`=reasoning_tokens。其他 provider 按各自能力填充，UI 有则展示无则隐藏

---

## 第 1 组：两个 Bug 修复

### Bug #7：result 接口报错

**根因**：`InterviewResult` model 在 migration `20260629061112_add_interview`（2026-06-29）新增。`packages/db/src/index.ts:7-11` 的 `globalThis.prisma` 单例在 dev 热重载场景下缓存旧 client（不含 `interviewResult` delegate）。`dev`/`start` 脚本不含 `db:generate`（仅 `bootstrap` 含），热重载后旧 client 不自愈。`InterviewService.getResult`（`interview-service.ts:121-127`）调 `prisma.interviewResult.findFirst` → delegate undefined → 崩。worker 端 `startOrGet`/`scoreAnswer`/`finalize` 同理受影响。

**修复**（三重防御）：

1. **启动脚本前置 generate**（`package.json`）：`dev`/`start` 脚本前置 `pnpm db:generate`，从源头保证 client 最新。修改 `apps/server` 和 `apps/worker` 的 dev 脚本依赖 db 包的 generate
2. **运行时防御**（`packages/shared/src/services/interview-service.ts`）：`getResult`/`startOrGet`/`scoreAnswer`/`finalize` 等方法首行加 `if (!prisma.interviewResult) return null`（或抛友好错误 `InterviewResult model 未就绪，请运行 pnpm db:generate`），避免 delegate undefined 时崩溃
3. **启动校验**（`apps/server/src/index.ts` / `apps/worker/src/index.ts`）：启动时校验 `prisma.interviewResult` 存在，缺失则 fail-fast 打印明确提示

**涉及文件**：

- `package.json`（dev/start 脚本）
- `packages/shared/src/services/interview-service.ts`（4 处方法防御）
- `apps/server/src/index.ts`、`apps/worker/src/index.ts`（启动校验）

**验证**：单元测试 mock `prisma.interviewResult = undefined`，断言返回 null 而非抛错；E2E 面试模式 `GET /interview/result` 不再 500

### Bug #6：诊断完成后路线图未渲染

**根因**：`learn.tsx:1004-1096` 是诊断提交专用的本地 SSE reader（独立于 useChatStream）。`:1035-1058` 收到 `tool-result` 且 `toolName === "generateRoadmap"` 时，**无条件**置 `roadmapGenerated = true`（`:1036`），但未校验 `result.success` 或 `result.roadmapUpdate.nodes` 是否存在。`generate-roadmap.ts:89-91` 在 `session?.roadmap` 不存在时返回 `{success:false, error:"..."}`（无 `roadmapUpdate`），此时 `:1038` 的 `setNodes` 不执行（nodes undefined），但 `:1100` 因 `roadmapGenerated=true` 显示"路线已生成…"，而右侧栏 `showRight = nodes.length > 0`（`:1175`）为 false → 不渲染。

**修复**：

1. **校验成功才置标志**（`learn.tsx:1035-1058`）：
   ```ts
   if (
     data.toolName === "generateRoadmap" &&
     data.result?.success &&
     data.result?.roadmapUpdate?.nodes?.length
   ) {
     setNodes(data.result.roadmapUpdate.nodes);
     roadmapGenerated = true;
   } else if (
     data.toolName === "generateRoadmap" &&
     data.result &&
     !data.result.success
   ) {
     // 工具失败：显示友好错误而非"已生成"
     setDiagnosticError(data.result.error ?? "路线图生成失败，请重试");
   }
   ```
2. **roadmap-updated 事件同样校验**（`learn.tsx:1061-1069`）：加 `data.nodes?.length > 0` 守卫
3. **失败时显示错误+可重试**：`diagnosticError` state，UI 显示错误提示 + 重试按钮，而非 `firstLessonPreparing` 的"已生成"loading
4. **fetchSession 兜底加延迟重试**（`learn.tsx:1116-1126`）：若首次 nodes 为空，短延迟（如 500ms）后重 fetch 一次，应对 DB 写入时序

**涉及文件**：

- `apps/web/src/pages/learn.tsx`（`:1035-1126` 校验逻辑 + 错误状态）

**验证**：E2E 诊断流程，mock generateRoadmap 返回 `{success:false}`，断言显示错误而非"已生成"；正常成功时路线图正确渲染

---

## 第 2 组：Agent Loop 健壮性迭代（#2 #4 #3）

### 2.1 前置：SSE 事件协议统一

**现状**：事件 type 散写——worker 端 `run-agent-loop.ts`（11 处）+ `chat-turn.ts`（3 处）用 `JSON.stringify({type:"..."})`；前端 `use-chat-stream.ts:188-338`（主链）和 `:447-564`（resume 链）两套几乎重复的 `if (event.type === "...")` 硬编码。`packages/shared` 无任何 SSE 事件 schema。

**方案**：新建 `packages/shared/src/schemas/sse-event.ts`：

- `SSEEventType` 常量枚举（含现有 + 新增）：
  - 现有：`text-delta` `tool-call` `tool-result` `ui-stream-start` `ui-block-delta` `ui-blocks` `code-push` `ask-question` `roadmap-updated` `session-updated` `title-updated` `error` `done`
  - 新增：`step-start` `step-end` `reasoning-delta` `usage` `context-info` `failover` `loop-warning` `abort`
- 每个 type 一个 zod schema，用 discriminatedUnion 组合成 `SSEEventSchema`
- 工厂函数 `createSSEEvent(type, payload)` + 解析函数 `parseSSEEvent(data)`
- 前端 `use-chat-stream.ts` 用 `parseSSEEvent` 替换两套重复 if 链，主链/resume 链共用一个 handler

**涉及文件**：

- 新建 `packages/shared/src/schemas/sse-event.ts`
- `packages/shared/src/index.ts`（导出）
- `apps/worker/src/agent/run-agent-loop.ts`、`apps/worker/src/processors/chat-turn.ts`（用工厂函数替换散写）
- `apps/web/src/hooks/use-chat-stream.ts`（用 parseSSEEvent 替换 if 链）

### 2.2 Abort Signal 链（#3 基础设施，也服务 #2）

建立贯穿 `chat-turn.ts` → `runAgentLoop` → `streamText` 的 abort signal：

**Control channel 方案**（已验证 BullMQ signal 不适用业务取消）：

- **channel 命名**：`chat:${sessionId}:control`（与 data channel `chat:${sessionId}` 解耦）
- **server**（`apps/server/src/routes/chat.ts:43`）：`stream.onAbort` 里额外用 publisher 往 control channel publish `{type:"abort"}`
- **新增 API**：`POST /api/sessions/:sessionId/abort` —— server 端 publish `{type:"abort"}` 到 control channel。即使用户不切模型只点停止，也能正确终止 worker（修复现状 stop() 资源泄漏）
- **worker**（`apps/worker/src/processors/chat-turn.ts:151`）：
  - processor 开始时 new 一个 Redis subscriber 订阅 `chat:${sessionId}:control`
  - 收到 abort 就 `abortController.abort()`
  - job 结束时 unsubscribe + quit subscriber
- **runAgentLoop**（`apps/worker/src/agent/run-agent-loop.ts`）：
  - `AgentLoopOptions`（`:10-19`）加 `abortSignal?: AbortSignal`
  - 循环顶部（`:51` deadline 检查旁）加 `if (abortSignal?.aborted) { stopReason = "aborted"; break; }`
  - `streamText({ ..., abortSignal })`（`:56`），中断当前 HTTP 流
  - `AgentLoopResult.stopReason`（`:25`）类型加 `"aborted"`
- **chat-turn 调用处**（`:377-386`）：传入 abortSignal

**前端 stop() 修复**（`apps/web/src/hooks/use-chat-stream.ts:361-364`）：

```ts
const stop = useCallback(async () => {
  abortControllerRef.current?.abort();
  setIsLoading(false);
  await fetch(`/api/sessions/${sessionId}/abort`, { method: "POST" });
}, [sessionId]);
```

### 2.3 Failover 分层降级（#2）

利用已验证的 LlmConfig fallback 字段 + 现成的 `executeWithRetry`（`packages/shared/src/services/retry.ts`），在单步 streamText 外层包降级链。

**LlmConfig schema 扩展**：

- `packages/db/prisma/schema.prisma` LlmConfig model 加：
  ```prisma
  fallbackModelId      String?  @db.Text
  fallbackLlmConfigId  String?  @db.Text
  fallbackConfig       LlmConfig? @relation("LlmConfigFallback", fields: [fallbackLlmConfigId], references: [id])
  fallbackFor          LlmConfig[] @relation("LlmConfigFallback")
  ```
- 迁移 `2026MMDDHHMMSS_add_llm_config_fallback/migration.sql`：
  ```sql
  -- 迭代 0XX：LlmConfig 加 fallback 字段，主模型失败时降级
  ALTER TABLE "LlmConfig" ADD COLUMN "fallbackModelId" TEXT;
  ALTER TABLE "LlmConfig" ADD COLUMN "fallbackLlmConfigId" TEXT;
  ALTER TABLE "LlmConfig" ADD CONSTRAINT "LlmConfig_fallbackLlmConfigId_fkey"
    FOREIGN KEY ("fallbackLlmConfigId") REFERENCES "LlmConfig"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  ```
- `packages/shared/src/schemas/llm-config.ts`：`CreateLlmConfigSchema` 加 `fallbackModelId: z.string().optional()` + `fallbackLlmConfigId: z.string().optional()`；`LlmConfigResponse` 加两字段

**降级链**（逐级尝试，每级内含指数退避重试）：

```
① 流式 streamText（主 model，主 config）
  └ executeWithRetry 包装，可重试错误：429/500/503/timeout/ECONNRESET/ETIMEDOUT
② 非流式 generateText（主 model，主 config）
  └ 同样的重试模式；拿到完整文本后模拟 text-delta 一次性下发
③ 流式 streamText（fallbackModelId，主 config）
  └ 仅当 config 配了 fallbackModelId
④ 流式 streamText（fallbackLlmConfigId 解析的 provider）
  └ 仅当 config 配了 fallbackLlmConfigId
```

**集成方式**：`runStepWithFailover(options)` 包装的是**单步**推理，由 `runAgentLoop` 的 for 循环每步调用（而非整个 loop 包一层）。即 `run-agent-loop.ts:56` 的 `streamText({...})` 替换为 `runStepWithFailover({model, system, messages, tools, ...})`，后者内部按降级链逐级尝试，返回与原 streamText 等价的 result（含 fullStream 供 loop 消费）。这样循环检测（§2.4）、step 计时（§3.1）仍由外层 loop 统一掌控，降级只影响单步的模型调用方式。

每级失败后 publish `failover` 事件 `{from, to, reason, step}` 让前端可见降级轨迹（用户已确认可见）。全部降级链耗尽才抛错走 `chat-turn.ts:454` 的 error 流程。

**关键约束**：

- 非流式降级（②）兼容流式协议：`generateText` 拿到完整文本后，模拟 `text-delta` 一次性下发，保证前端体验连续
- `getProviderForJob`（`chat-turn.ts:66-93`）扩展为返回主 provider + fallback provider 链，而非单个
- 非流式降级时 reasoning/step 等过程事件无法产出（generateText 不流式），UI 能接受"降级模式无过程"
- abort signal 贯穿所有降级层级（任一级被 abort 都终止整个降级）

**涉及文件**：

- `packages/db/prisma/schema.prisma` + 新迁移
- `packages/shared/src/schemas/llm-config.ts`
- `packages/shared/src/services/provider-select.ts`（resolveFallbackProvider）
- `apps/worker/src/processors/chat-turn.ts`（getProviderForJob 扩展）
- 新建 `apps/worker/src/agent/run-step-with-failover.ts`
- `apps/web/src/components/settings/llm-config-form.tsx`（step 2 ModelSelector 下方加 fallback 分区）

### 2.4 循环检测（#4）

在 `run-agent-loop.ts` for 循环内累积每步 tool 调用，做三类检测：

**① 哈希指纹检测**：对每步 `{toolName, normalizedArgs}` 做 hash，维护最近 N 步指纹集合。同指纹连续出现 ≥ 阈值（默认 2）→ 判定循环。

**② Ping-pong 检测**：检测 A→B→A→B 交替模式。维护最近 4 步指纹序列，匹配 `X-Y-X-Y` → 判定 ping-pong。

**③ 全局熔断**：单次 loop 内累计"循环纠正次数" ≥ 3 仍无进展 → 熔断。

**处理流程**（用户已选"注入提示+熔断"）：

```
检测到循环
  → 注入系统消息「你连续重复调用了 {toolName}，请换思路或直接用已有信息回答」
  → 允许 1-2 次纠正机会（继续 loop）
  → 仍循环 → 熔断：publish {type:"error", reason:"loop-detected"} + 友好提示
  → 检测时 publish {type:"loop-warning", ...} 让前端可见（可选展示）
```

**误杀防护**：

- `retrieve-context`/`search` 类只读工具的合法分页/重试需排除 —— 放宽阈值或对 args 做更细归一化（忽略分页 offset）
- 工具列表维护一个"可重复调用白名单"，白名单内工具不参与 ping-pong 检测，只参与极端重复（连续 5+ 次相同）熔断

**涉及文件**：

- 新建 `apps/worker/src/agent/loop-detector.ts`（指纹 + ping-pong + 熔断逻辑，纯函数易测试）
- `apps/worker/src/agent/run-agent-loop.ts`（集成检测 + 注入提示）

### 2.5 模型回答中切换（#3）

基于 2.2 的 abort signal 链：

- **前端**（`apps/web/src/components/chat/chat-input.tsx:111-149`）：模型下拉 `isLoading` 时 `disabled`，显示"回答中…"
- **回答结束后**：切换只改 `selectedConfigId` state，对下一条消息生效（现状行为保留）
- **修复 stop() 资源泄漏**：见 2.2 的 `POST /api/sessions/:id/abort`，worker 真正终止 job

**涉及文件**：

- `apps/web/src/components/chat/chat-input.tsx`（disabled 守卫）
- `apps/server/src/routes/chat.ts`（新增 abort 路由）
- `apps/web/src/hooks/use-chat-stream.ts`（stop 调 abort API）

---

## 第 3 组：过程可视化 + Token + 互动优化（#1 #5 #6体验）

### 3.1 消息级折叠过程面板（#1）

每条 AI 消息下方加**默认折叠**的「思考过程」面板，点开展示该轮 loop 全过程。

**面板结构**（展开后）：

```
┌─ 🧠 思考过程（3 步 · 用时 12s）          [展开/折叠] ─┐
│  ┌─ 步骤 1/7  · 2.1s ─────────────────────────────┐   │
│  │ 💭 思考：用户问的是复利，我需要先...（reasoning）│   │
│  │ 🔧 retrieve-context({"query":"复利公式"}) 1.2s │   │
│  │    → 返回 3 段资料                               │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─ 步骤 2/7  · 3.4s ─────────────────────────────┐   │
│  │ 🔧 renderUI({...互动课...}) 0.8s               │   │
│  │ 💭 思考：基于资料生成互动练习...                 │   │
│  └─────────────────────────────────────────────────┘   │
│  ⚠️ 降级：主模型超时 → 非流式重试（步骤 2）           │
└────────────────────────────────────────────────────────┘
```

**数据来源**：复用 `UIMessage.metadata.annotations` 已存但未渲染的 tool-call/tool-result，并新增事件消费。

**新增 SSE 事件消费**（走 2.1 统一协议）：

- `step-start`：`{step, total: maxSteps, t0}` —— 循环每步开始
- `step-end`：`{step, durationMs, stopReason}` —— 每步结束带耗时
- `reasoning-delta`：`{step, text}` —— 思考流式增量（有则展示无则隐藏）
- `failover`：`{from, to, reason, step}` —— 降级轨迹（来自 2.3）
- `loop-warning`：`{type, toolName, step}` —— 循环检测提示（来自 2.4，可选展示）

**Loading 时的预估**：不做时间预估。展示「已用时 Xs · 第 N 步/共 maxSteps」实时进度（来自 step-start 的 t0 和当前时间）。

**worker 端产出点**（`run-agent-loop.ts`）：

- `:50` 循环顶部发 `step-start`
- `:78` fullStream 处理前加 `reasoning-start`/`reasoning-delta`/`reasoning-end` 分支（目前完全缺失）
- `:152` 每步结束发 `step-end`（带耗时，用 `Date.now() - stepT0`）
- tool-call/tool-result 已有事件，前端补 UI 渲染

**前端组件**：新建 `apps/web/src/components/chat/loop-trace-panel.tsx`，挂载在 `chat-message.tsx:84` 的 uiBlocks 渲染之后。折叠状态用本地 state，默认折叠。无过程数据（如 quick-question 链路）时不渲染面板。

**涉及文件**：

- 新建 `apps/web/src/components/chat/loop-trace-panel.tsx`
- `apps/web/src/components/chat/chat-message.tsx`（挂载面板）
- `apps/web/src/hooks/use-chat-stream.ts`（新增事件分支，存入 annotation）
- `apps/worker/src/agent/run-agent-loop.ts`（产出 step-start/end/reasoning 事件）

### 3.2 Token 展示 — 聊天框底部双向圆（#5）

provider 无关，统一读 `LanguageModelUsage`，有则展示无则隐藏。

**布局位置**：聊天框底部（输入区上方），一个紧凑的 token 仪表盘。

**双向圆设计**（输入/输出对比）：

```
        ┌──── 双向圆 ────┐
   输入 │   ╭───╮        │
  3240  │  │ 54%│  输出   │  1840
        │   ╰───╯  31%   │
        └─────────────────┘
  本会话累计: 12,450 tokens
  ├ 缓存命中: 2,100 (17%)  [cacheRead]
  ├ 思考: 820 (7%)         [reasoningTokens]
  └ 预估 system+tools: 980 [estimateTokens 标注估算]
```

**数据分层**：

- **真实用量层**（`LanguageModelUsage`，provider 无关）：
  - `inputTokens` / `outputTokens` / `totalTokens` → 双向圆主数据
  - `inputTokenDetails.cacheReadTokens`（缓存命中）→ 圆下方明细，有则展示
  - `inputTokenDetails.cacheWriteTokens`（缓存写入）→ 有则展示
  - `outputTokenDetails.reasoningTokens`（思考）→ 圆下方明细，有则展示
- **估算层**（`estimateTokens`，与 provider 无关，API 不拆分，标注"估算"）：
  - system prompt 占用 + tools 定义占用
- **会话累计**：逐条累加 totalTokens，存内存 state（不持久化，刷新重置）

**数据流**：

- worker：`run-agent-loop.ts:56` streamText 加 `onFinish` 回调，读 `result.totalUsage`，publish `usage` 事件 `{usage, provider, raw}`（raw 透传以备 provider 特有字段，如 deepseek 的 promptCacheMissTokens）
- 前端：`use-chat-stream.ts` 加 `usage` 事件分支，累加到会话 state
- 上下文占比：worker `chat-turn.ts:369` prepareForStream 后 publish `context-info` `{tokenCount, budget: 6000, needsCompaction}`；前端展示「上下文 3240/6000（54%）」+ 压缩触发提示

**组件**：新建 `apps/web/src/components/chat/token-meter.tsx`，用 SVG 画双向圆。挂在聊天框底部（`chat-area.tsx` 输入区上方）。

**涉及文件**：

- 新建 `apps/web/src/components/chat/token-meter.tsx`
- `apps/web/src/components/chat/chat-area.tsx`（挂载 token meter）
- `apps/web/src/hooks/use-chat-stream.ts`（usage/context-info 事件分支）
- `apps/worker/src/agent/run-agent-loop.ts`（onFinish 回调 + usage 事件）
- `apps/worker/src/processors/chat-turn.ts`（context-info 事件）

### 3.3 互动练习体验优化（#6 体验部分）

用户已选"扩展现有 A2UI 组件库"，本期加齐 5 种 explore 组件。Bug 部分（路线图未渲染）已在第 1 组修复。

**扩展的 explore 组件类型**（`packages/shared/src/schemas/ui-block.ts:112-127` 的 discriminatedUnion 增加成员）：

- 现有：`slider`、`input`
- 新增：
  - `choice`（单选/多选）：options[{id,text}] + allowMultiple
  - `matching`（左右匹配）：leftItems[] + rightItems[] + 正确映射
  - `ordering`（拖拽排序）：items[] + 正确顺序
  - `fill-blank`（填空）：template 含占位符 + 各占位正确答案/提示
  - `chart-slider`（带实时图表反馈的滑块）：在 slider 基础上实时画函数曲线

**前端**：每个新组件一个 React 文件 `apps/web/src/components/ui-blocks/explore/{choice|matching|ordering|fill-blank|chart-slider}.tsx`，复用项目统一配色 token（`border-border`/`bg-card`/`rounded-xl`/`accent`/`primary`），与现有 callout/comparison/interactive block 风格一致。

**AI 端**：

- `apps/worker/src/agent/tools/render-ui.ts:60-90` 的 explore schema 扩展
- `apps/worker/src/agent/prompts/tutor.ts:77-94` 补充各组件使用场景说明，让 AI 按知识点类型选合适组件

**统一风格**：新 explore 组件统一用 `Card` 组件（`apps/web/src/components/ui/card.tsx`）。存量 block 风格一致性留作后续评估，避免范围蔓延。

**iframe 残留清理**（低优先，顺手）：

- `interactive-block.tsx:20` 的 `InteractiveSubmitPayload.source` 删除 `"iframe"` 字面量
- `provider-registry.ts:54` 过时注释更新

**涉及文件**：

- `packages/shared/src/schemas/ui-block.ts`（explore discriminatedUnion 扩展）
- 新建 `apps/web/src/components/ui-blocks/explore/*.tsx`（5 个组件）
- `apps/web/src/components/ui-blocks/interactive-block.tsx`（渲染分发 + iframe 残留清理）
- `apps/worker/src/agent/tools/render-ui.ts`（schema 扩展）
- `apps/worker/src/agent/prompts/tutor.ts`（组件使用说明）

---

## 文档同步

按 `文档同步规则.md` 触发映射表，本设计涉及：

- `docs/设计/API接口.md`：新增 `POST /api/sessions/:id/abort`、LlmConfig 字段扩展、SSE 事件类型清单更新
- `docs/设计/技术架构.md`：agent loop failover/循环检测/abort 通道、SSE 协议统一、token 展示数据流、互动组件库扩展
- `docs/设计/Prompt设计.md`：互动课 explore 组件使用说明
- `docs/设计/决策记录.md`：新增 ADR（failover 分层降级策略、循环检测注入提示+熔断、abort control channel 方案、token provider 无关设计）
- `docs/开发/迭代计划.md`：新增迭代编号（待定，建议 055-057）
- `docs/开发/迭代详情/`：每组一个详情文件

## E2E 测试映射

按 `质量门控.md` 映射表：

- Bug #7：S 类（面试模式）`e2e/interview.spec.ts`
- Bug #6：A 类（诊断）`e2e/diagnostic.spec.ts`、B 类（路线图）`e2e/learn.spec.ts`
- #1 过程可视化：J 类（流式）`e2e/chat.spec.ts` 新增过程面板断言
- #2/#4 健壮性：需新增 failover/循环检测的 E2E（mock 模型失败场景）
- #3 切换：`e2e/llm-config.spec.ts` 新增回答中禁用断言
- #5 token：`e2e/chat.spec.ts` 新增 token meter 断言
- #6 互动：Q 类 `e2e/interactive-lesson.spec.ts` 新增 explore 组件测试
