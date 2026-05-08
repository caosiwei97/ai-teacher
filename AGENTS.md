# AI Teacher — Agent 工作协议

> 本文件是所有 Agent session 的**入口文件**。新 session 启动时必须先读本文件，按协议执行。

---

## 1. Session 启动流程（每次必做）

### 1.1 恢复上下文

新 session 打开后，**必须**按顺序读取以下文件：

```
1. AGENTS.md          ← 本文件，协议入口
2. docs/dev-log.md    ← 开发日志，找到上次中断点和未完成项
3. docs/3-development/iteration-plan.md  ← 迭代计划和当前进度
```

### 1.2 确定工作起点

从 `dev-log.md` 最后一条记录中提取：

- **上次中断位置**：最后完成的迭代编号或具体任务
- **未完成事项**：日志中标记为 `⬜` 或 `[ ]` 的待办
- **阻塞问题**：日志中标注的 "阻塞" / "待确认" 项

**如果日志末尾没有明确标记中断原因**，读取 git log 最近 5 条提交推断：

```bash
git log --oneline -10
```

### 1.3 向用户确认

恢复上下文后，向用户汇报：

```
📋 上下文恢复：
- 上次进展：{最后完成的事项}
- 当前迭代：{迭代编号} — {名称}
- 待处理：{未完成列表}

准备继续 {下一项任务}，确认？
```

---

## 2. 开发过程规范

### 2.1 dev-log 记录规则

**时间格式**：`#### YYYY-MM-DD HH:MM — {标题}`（精确到分钟）

**每条记录必须包含**：

```markdown
#### YYYY-MM-DD HH:MM — {标题}

**状态**：✅ 已完成 | 🔧 进行中 | ⏸️ 暂停 | ❌ 失败

**事件**：
- {做了什么}

**代码变更**：
- `path/to/file` — {改了什么}

**验证结果**：
- {测试/构建/手动验证的结果}

**下一步**：{明确的下一步}
```

**记录时机**：
- 每个独立任务完成时（不是整个迭代结束时）
- 发现 bug 时记录问题和修复方案
- 用户做出关键决策时
- session 结束前必须记录当前状态

### 2.2 迭代计划同步

**每次开始新迭代时**，更新 `docs/3-development/iteration-plan.md`：

- 将对应迭代的 `[ ]` 改为 `[x]`
- 更新状态列：`⬜ 待开始` → `🔧 进行中` → `✅ 已完成`

### 2.3 文档同步规则

**代码变更时，必须同步更新对应文档**：

| 代码变更 | 必须更新的文档 |
|---------|-------------|
| 新增 API 路由 | `docs/2-design/architecture.md` 的 API 列表 |
| 修改数据模型 | `docs/2-design/architecture.md` 的数据模型章节 |
| 新增 Agent 工具 | `docs/2-design/prompt-design.md` 的工具定义 |
| 新增 UI 组件 | 无需单独文档（代码即文档） |
| 新增依赖 | `README.md` 技术栈表格 |
| 修改端口/配置 | `.env.example` + `README.md` 服务端口表 |
| 完成迭代 | `iteration-plan.md` 状态 + `dev-log.md` 记录 |

### 2.4 质量门控

**提交代码前必须通过**：

```bash
# 1. 构建
pnpm --filter @ai-teacher/web build

# 2. E2E 测试
npx playwright test

# 3. 两者都通过才允许 commit
```

**如果测试发现 bug**：
1. 先修复 bug
2. 重新跑测试
3. 全部通过后再提交

---

## 3. 技术约束（不可违反）

- **pnpm workspaces**（不用 npm）
- **命名导出**（不用 default export）
- **中文 UI 文本**
- **注释仅在必要时添加**
- **端口**：Web 38421, Worker 38422, PG 25432, Redis 26379, MinIO 29000/29001
- **LLM**：智谱 OpenAI 兼容接口，默认 `glm-4-flash`
- **PostCSS**：必须用 `module.exports`（不用 `export default`）
- **.env**：通过 symlink `apps/web/.env → ../../.env` 共享
- **Tailwind CSS 4**：颜色用 `@theme` CSS 变量，不用硬编码色值

---

## 4. 项目结构速查

```
apps/
  web/          — Next.js 15 (App Router) + Chat UI + API Routes
  worker/       — Agent 核心 (AI SDK streamText + 5 tools)
packages/
  shared/       — Zod schemas, types
  db/           — Prisma schema + seed
infra/docker/   — Docker Compose (PG + Redis + MinIO)
e2e/            — Playwright E2E tests
docs/           — 项目文档
  dev-log.md    — 开发日志（时间线）
  3-development/iteration-plan.md — 迭代计划
```

---

## 5. Session 结束流程

**session 结束前（或用户说"结束"/"先到这里"）**，必须完成：

1. ✅ 更新 `docs/dev-log.md` — 记录本次 session 所有工作
2. ✅ 更新 `docs/3-development/iteration-plan.md` — 同步迭代状态
3. ✅ 如有代码变更，确认已提交并推送
4. ✅ 在 dev-log 末尾标注**下次 session 应从哪里继续**
