# AI Teacher — 开发日志

> 记录开发过程中的关键时间节点和决策，防止上下文溢出后丢失信息。

---

## 时间线

### 2026-05-08 — 项目初始化

**事件**：
- 完成 同类竞品 产品深度拆解（通过 Playwright 访问真实交互页面）
- 创建项目骨架：`~/projects/ai-teacher/`
- 初始化 Git 仓库

**产品决策**：
- 定位：AI 1v1 私教平台，用户可上传学习资料
- 参考：同类苏格拉底教学产品（苏格拉底式追问 + 掌握度门控）+ NotebookLM（用户上传资料）
- MVP 不做支付/订阅，专注核心教学体验
- 技术栈：Next.js 15 + AI SDK + PostgreSQL + pgvector + Docker Compose

**文档产出**：
- `docs/0-kickoff/kickoff.md` — 项目总纲
- `docs/1-requirements/prd.md` — 产品需求文档
- `docs/2-design/architecture.md` — 技术架构设计
- `docs/2-design/prompt-design.md` — 苏格拉底式教学 Prompt 设计
- `docs/3-development/iteration-plan.md` — 12 个迭代的详细计划

**关键文件索引**：
```
docs/
├── 0-kickoff/kickoff.md          ← 项目一句话描述、核心场景、约束边界
├── 1-requirements/prd.md         ← 用户故事、功能规格、MVP 范围
├── 2-design/
│   ├── architecture.md           ← 技术栈、系统架构、数据模型、API、Docker
│   └── prompt-design.md          ← 苏格拉底 Prompt 模板、工具定义、对话示例
├── 3-development/
│   └── iteration-plan.md         ← 12 个迭代、关键路径、详细 checklist
└── dev-log.md                    ← 本文件
```

### 2026-05-08 (2) — 同类苏格拉底教学产品 完整功能体验 + E2E 测试用例

**事件**：
- 通过 Playwright 系统体验了 同类苏格拉底教学产品 的完整用户流程
- 创建新会话 → 输入 "React Hooks 的原理和使用" → 诊断摸底（3 Tab 选择题）→ 提交 → 知识图谱自动生成（9 节点）→ 苏格拉底追问教学

**同类苏格拉底教学产品 新发现**（之前未观察到的细节）：
- **新会话首页**：有欢迎语 "告诉我你对什么感兴趣" + 6 个推荐主题卡片
- **诊断 UI**：用 Tab 切换多组问题，每组有 4-5 个梯度选项 + "其他（自由输入）"
- **Tab 已回答标记**：回答后 Tab 旁出现 ✓ 图标
- **教学模式默认值**：新会话默认 "温暖私教"，之前那个课程会话是 "严格教练"
- **PWA 安装提示**：底部弹出 "安装 同类苏格拉底教学产品" 弹窗
- **AI 建议回复**：诊断结束后才出现（新会话首页没有）
- **语音输入**：诊断期间 disabled，诊断结束后可用
- **知识图谱节点数**：自定义主题生成了 9 个节点（比预设课程的 5 个更多）
- **右侧栏**：有 "路线图" 和 "学习笔记" 两个 Tab

**文档产出**：
- `docs/4-testing/e2e-test-cases.md` — 20 个 E2E 测试用例（P0: 13 个, P1: 7 个）

**待确认事项**：
- [ ] 用户确认 PRD 和技术架构
- [ ] 确认 LLM 提供商（OpenAI / Anthropic）
- [ ] 确认是否需要 OpenAI API Key（或用其他提供商）

### 2026-05-08 (3) — 迭代 001：项目骨架 + Docker 环境

**事件**：
- 迭代 001 开始执行并完成
- 用户要求使用 pnpm 替代 npm workspaces
- Docker Hub 国内网络不通，通过 dockerproxy.net 镜像代理拉取 pgvector/minio

**技术决策**：
- 使用 pnpm workspaces（用户建议，替代 npm workspaces）
- 非标准端口避免本地冲突：Web 38421, Worker 38422, PG 25432, Redis 26379, MinIO 29000/29001
- Prisma 子包通过 dotenv-cli 读取根目录 .env
- `shamefully-hoist=true` 确保 Next.js/Prisma 依赖能正确解析

**代码变更**：
- `package.json` + `pnpm-workspace.yaml` + `.npmrc` — pnpm monorepo 根配置
- `apps/web/` — Next.js 15 + React 19 + Tailwind CSS 4 + AI SDK
- `apps/worker/` — Agent Worker 骨架（tsx watch）
- `packages/shared/` — Zod schemas（SessionStatus, MessageRole, CreateSessionInput 等）
- `packages/db/` — Prisma Schema（User, Source, Session, Roadmap, Node, Message, LearnerProfile）+ 初始迁移
- `infra/docker/docker-compose.yml` — PostgreSQL 16 + pgvector, Redis 7, MinIO（非标准端口）
- `.env.example` — 环境变量模板
- `.prettierrc` + `tsconfig.base.json` — 代码规范

**验证结果**：
- `docker compose up -d` → 3 services healthy ✅
- PostgreSQL: `psql SELECT 1` → connected ✅
- Redis: `redis-cli ping` → PONG ✅
- MinIO: `curl /minio/health/live` → 200 ✅
- `prisma migrate dev` → 迁移成功 ✅
- `next dev -p 38421` → 返回 200 ✅

### 2026-05-08 (4) — 迭代 002+003：数据模型 + 苏格拉底 Agent 核心

**事件**：
- 迭代 002（种子数据）和 003（Agent 核心）并行完成
- 发现智谱模型名不是 `glm-4-plus`，实际可用 `glm-4-flash` / `glm-4.5` / `glm-5`
- Next.js 子目录无法读取根 .env，通过 symlink 解决

**技术决策**：
- LLM 提供商：智谱（OpenAI 兼容接口），默认模型 `glm-4-flash`
- Web → Worker 跨 workspace import（`../../../../../worker/src/agent/tutor`）通过了 Next.js webpack 构建
- .env 通过 symlink (`apps/web/.env → ../../.env`) 共享给子项目

**代码变更**：
- `packages/db/prisma/seed.ts` — 种子数据（test user + React Hooks 主题 + 5 节点 roadmap + 示例消息）
- `apps/worker/src/agent/prompts/tutor.ts` — 苏格拉底 system prompt 模板
- `apps/worker/src/agent/tools/` — 5 个 Agent tools（assessMastery, generateAssessment, recordStrength, recordMisconception, advanceNode）
- `apps/worker/src/agent/tutor.ts` — Agent Loop（AI SDK streamText + 智谱 provider）
- `apps/web/src/app/api/chat/route.ts` — SSE 流式 Chat API（session 加载 → Agent 调用 → 消息持久化 → 节点状态更新）
- `apps/web/src/app/api/sessions/route.ts` — Session CRUD（创建 + 列表 + placeholder roadmap）
- `apps/web/src/app/api/sessions/[id]/route.ts` — Session 详情

**验证结果**：
- `pnpm --filter @ai-teacher/db seed` → 种子数据写入成功 ✅
- `pnpm --filter @ai-teacher/web build` → 构建成功 ✅
- `pnpm --filter @ai-teacher/worker build` → 构建成功 ✅
- `GET /api/sessions?userId=seed-user-ai-teacher` → 返回 session 列表 ✅
- `POST /api/chat` → 智谱 `glm-4-flash` 流式返回苏格拉底教学回答 ✅

### 2026-05-08 (5) — 迭代 004：Chat UI + 三栏布局

**事件**：
- shadcn/ui 初始化 + 7 个基础组件安装（button, input, card, scroll-area, separator, avatar, badge）
- 完整三栏布局实现：左侧会话列表 + 中央对话 + 右侧路线图
- Chat 页面 `/learn/[sessionId]` 端到端可用

**代码变更**：
- `apps/web/components.json` — shadcn/ui 配置
- `apps/web/src/components/ui/` — shadcn 基础组件
- `apps/web/src/components/chat/` — chat-area, chat-message, chat-input, code-block
- `apps/web/src/components/layout/` — three-column, left-sidebar, right-sidebar
- `apps/web/src/components/roadmap/` — roadmap-node
- `apps/web/src/hooks/use-chat-stream.ts` — AI SDK useChat 封装
- `apps/web/src/lib/api-client.ts` — sessions API 客户端
- `apps/web/src/app/learn/[sessionId]/page.tsx` — 学习页（三栏 + 流式对话）

**验证结果**：
- `pnpm --filter @ai-teacher/web build` → 构建成功，/learn/[sessionId] 42.6kB ✅
- 首页 HTTP 200 ✅
- Learn 页面 HTTP 200 ✅

### 2026-05-08 (6) — 迭代 005：知识图谱生成 + 可视化

**事件**：
- Roadmap Agent 实现，使用 AI SDK `generateObject` + Zod Schema 约束输出
- Session 创建 API 从 placeholder nodes 改为调用 LLM 动态生成知识图谱
- LLM 生成失败时自动 fallback 到通用 5 节点模板

**代码变更**：
- `packages/shared/src/schemas/roadmap.ts` — RoadmapOutput Zod Schema（5-15 节点约束）
- `apps/worker/src/agent/roadmap.ts` — Roadmap Agent（智谱 glm-4-flash + generateObject）
- `apps/web/src/app/api/sessions/route.ts` — 创建会话时调用 Roadmap Agent

**验证结果**：
- 创建 "TypeScript 泛型入门" 会话 → LLM 生成 11 个知识点 ✅
- 节点按依赖顺序排列，首个自动设为 in-progress ✅
- 右侧栏路线图展示节点状态（✓/●/○）+ 进度条 ✅

---

## 模板

```markdown
### YYYY-MM-DD — {标题}

**事件**：
- 

**产品决策**：
- 

**代码变更**：
- 

**文档产出**：
- 

**待确认事项**：
- [ ]
```
