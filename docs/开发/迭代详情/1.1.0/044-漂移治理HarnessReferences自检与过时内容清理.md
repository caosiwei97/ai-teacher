# 迭代 044：漂移治理 — Harness References 自检 + 过时内容清理

> 优先级：P1 | 分类：优化 | 状态：✅ 已完成（2026-06-26）
> E2E：无新增

## 不足点

`.agents/references/` 是 Harness Engineering 的核心引导制品，但它们本身**没有漂移治理机制**。一个讽刺的事实是：

- `缓存与重启.md` 引用了 `apps/web/.next` 和 Next.js 配置（`修改 next.config.* 需要重启`），但项目已在迭代 040 迁移到 Vite
- 文档同步规则要求 AI "立即修正文档"，但 references/ 文件本身不在文档同步的触发映射表中
- 没有"谁在什么时候检查过 references/ 的准确性"的机制

**参考资料来源：**

- OpenAI Codex 团队实践：recurring "doc-gardening" agent 定期扫描过时文档，自动开 fix-up PR。"Technical debt is like a high-interest loan: it's almost always better to pay it down continuously in small increments."
- Martin Fowler《Harness engineering for coding agent users》（2026.04）："Continuous drift and health sensors"——漂移是渐进积累的，需要持续监控而非一次性修复
- Martin Fowler 引用 Thoughtworks 团队实践："janitor army"——多 agent 并行扫描不同维度的代码质量问题

## 目标

1. 立即修复所有已知的 references/ 过时内容
2. 在文档同步触发映射表中加入 references/ 文件
3. 建立定期漂移检查机制

## 可优化方向

### 1. 立即修复：缓存与重启.md

**当前过时内容：**

| 行            | 过时内容                                                                 | 应更新为                                                              |
| ------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 标题 + 触发表 | `rm -rf apps/web/.next`                                                  | `rm -rf apps/web/node_modules/.vite`（Vite 缓存目录）                 |
| 触发表        | 修改 `postcss.config.mjs` 或 `tailwind.config.*`                         | Vite 项目无 `tailwind.config.*`，用 `@config` 指令或 `vite.config.ts` |
| 触发表        | 修改 `.env` 或环境变量——"Next.js 在启动时读取环境变量"                   | Vite 通过 `import.meta.env` 注入，需重启 dev server                   |
| 触发表        | 修改 `next.config.*`                                                     | 不适用，删除此行                                                      |
| 触发表        | "Next.js App Router 缓存了路由映射"                                      | Vite 不缓存路由，可删除或改为 Vite 相关                               |
| 重启表        | "添加新的 API route 文件（首次）— 部分情况下 Next.js 不会自动检测新文件" | Hono 路由在 `apps/server/src/routes/` 下注册，新增文件需重启 Worker   |

### 2. 扩展文档同步映射表

在 `文档同步规则.md` 的触发映射表中新增：

| 代码变更               | 必须更新的 references/ 文件     |
| ---------------------- | ------------------------------- |
| 修改构建工具或打包配置 | `缓存与重启.md`                 |
| 修改项目骨架结构       | `质量门控.md`（检查路径引用）   |
| 修改技术栈             | `缓存与重启.md` + `质量门控.md` |
| 修改 ports/env 配置    | `缓存与重启.md`                 |

### 3. Session 启动时漂移自检

在 AGENTS.md 的 Session 启动流程中增加一步：定期（每 5 个 session）运行 `pnpm check:docs`，确认 references/ 与实际代码一致。

## 实施步骤

### Phase 1：修复已知过时内容

1. 重写 `缓存与重启.md`，对齐 Vite + Hono 技术栈
2. 检查其余 4 个 references/ 文件是否有类似过时引用
3. 在 `开发日志.md` 中记录修复

### Phase 2：扩展同步映射表

1. 在 `文档同步规则.md` 中新增 references/ 相关触发条目
2. 在 `质量门控.md` 中新增 references/ 时效性检查提示

### Phase 3：漂移自检机制

1. 在 AGENTS.md §1.1 中新增：每 5 个 session 检查一次 references/ 时效性
2. 或：在 `pnpm check:docs` 中新增 references/ 文件引用路径的有效性检查

## 验收标准

- [x] `缓存与重启.md` 已完全对齐 Vite + Hono 技术栈，无 Next.js 残留引用
- [x] 其余 references/ 文件已检查，无过时内容（grep 确认无 Next.js 残留）
- [x] `文档同步规则.md` 已新增 references/ 相关触发条目（构建工具/技术栈/端口配置）
- [x] `pnpm check:docs` 新增第 6 项 references 文件存在性检查（漂移机制）

## 风险

- references/ 文件的修复可能暴露其他文档中的过时引用（连锁更新）
- 需要确保修复后的 references/ 在实际 AI session 中有效（可能需要实际 session 验证）

## E2E 影响

无
