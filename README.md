# AI Teacher

AI 1v1 私教平台 — 用户上传学习资料，系统生成知识图谱，通过苏格拉底式追问引导真正掌握。

> **数据安全**：所有数据（数据库、缓存、文件存储）均存储在本地 Docker 容器中，数据目录挂载到项目 `./data/`，不会上传到任何外部服务器。LLM API 调用仅传输对话内容用于生成回复。

## 快速开始

```bash
# 1. 一键初始化（环境变量 + 中间件 + 数据库初始化）
pnpm bootstrap
# 首次运行会自动从 .env.example 创建 .env，请编辑填入 API Key 后重新执行

# 2. 一键开发（Web + Worker 并行启动）
pnpm dev
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm bootstrap` | 一键初始化：配置环境变量 → 启动中间件 → 迁移数据库 → 种子数据 |
| `pnpm dev` | 并行启动 Web（:38421）+ Server（:38422）+ Worker（:38423） |
| `pnpm docker:up` | 启动所有中间件（PostgreSQL、Redis、MinIO） |
| `pnpm docker:down` | 停止所有中间件 |
| `pnpm build` | 构建所有包 |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:seed` | 执行种子数据 |
| `pnpm test:e2e` | 运行 E2E 测试 |

### Docker 镜像加速（国内用户）

如果 `pnpm bootstrap` 中 Docker 拉取镜像缓慢或失败，需配置 Docker 镜像加速源。

请参考 [dongyubin/DockerHub](https://github.com/dongyubin/DockerHub) 获取当前可用的国内镜像源列表，按其中的教程配置 `registry-mirrors`。

## 项目结构

```
apps/
  web/        — Next.js App Router (Chat UI，纯前端)
  server/     — Hono API Server (REST API + SSE)
  worker/     — Agent Worker (BullMQ 队列消费 + AI SDK streamText + 5 tools)
packages/
  shared/     — 共享类型、Zod Schema
  db/         — Prisma Schema + 数据库访问
  agent/      — 共享 Agent 引擎（StateGraph + ToolRegistry + Checkpoint）
docs/         — 项目文档
data/         — 本地数据存储（已加入 .gitignore）
```

## 本地数据存储

```
data/
├── postgres/    # PostgreSQL 数据文件
├── redis/       # Redis 持久化文件
└── minio/       # MinIO 对象存储文件
```

所有数据通过 Docker volume bind-mount 存储在本地 `./data/` 目录，可通过 `.env` 修改挂载路径。

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Web | 38421 | Next.js 开发服务器（纯前端） |
| API Server | 38422 | Hono API Server |
| Worker | 38423 | BullMQ Worker（Agent 执行） |
| PostgreSQL | 25432 | 数据库（非标准端口避免冲突） |
| Redis | 26379 | 缓存（非标准端口） |
| MinIO API | 29000 | 对象存储 |
| MinIO Console | 29001 | 对象存储管理界面 |

## 文档

| 文档 | 说明 |
|------|------|
| [产品定位](docs/产品/产品定位.md) | 项目总纲、核心场景、约束边界 |
| [需求规格](docs/产品/需求规格.md) | 用户故事、功能规格、MVP 范围 |
| [技术架构](docs/设计/技术架构.md) | 技术栈、系统架构、数据模型 |
| [API 接口](docs/设计/API接口.md) | 已实现的接口文档 |
| [Prompt 设计](docs/设计/Prompt设计.md) | 苏格拉底式教学 Prompt |
| [决策记录](docs/设计/决策记录.md) | 关键技术决策及原因 |
| [迭代计划](docs/开发/迭代计划.md) | 12 个迭代、状态、进度 |
| [开发日志](docs/开发/开发日志.md) | 开发时间线记录 |
| [E2E 测试](docs/测试/e2e/README.md) | 测试用例矩阵 |

## 技术栈

| 层 | 技术 |
|---|------|
| Web | Next.js 15, React 19, shadcn/ui, Tailwind CSS 4 |
| Agent | AI SDK v6 (streamText + tool calling) |
| LLM | DeepSeek（@ai-sdk/deepseek 原生 provider），默认 `deepseek-v4-flash` |
| DB | PostgreSQL 16 + pgvector + Prisma ORM |
| Cache | Redis 7 |
| Storage | MinIO (S3 兼容) |
| Runtime | Node.js 20 LTS, TypeScript strict |
| Package Manager | pnpm workspaces |
