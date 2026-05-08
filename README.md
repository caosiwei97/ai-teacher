# AI Teacher

AI 1v1 私教平台 — 用户上传学习资料，系统生成知识图谱，通过苏格拉底式追问引导真正掌握。

> **数据安全**：所有数据（数据库、缓存、文件存储）均存储在本地 Docker 容器中，数据目录挂载到项目 `./data/`，不会上传到任何外部服务器。LLM API 调用仅传输对话内容用于生成回复。

## 快速开始

```bash
# 1. 复制环境变量
cp .env.example .env
# 编辑 .env 填入 LLM API Key

# 2. 一键启动中间件（PostgreSQL + Redis + MinIO）
docker compose -f infra/docker/docker-compose.yml up -d

# 3. 安装依赖 + 初始化数据库
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm --filter @ai-teacher/db seed

# 4. 启动开发服务
pnpm dev:web      # Next.js :38421
pnpm dev:worker   # Worker  :38422
```

## 项目结构

```
apps/
  web/        — Next.js App Router (Chat UI + API)
  worker/     — Agent 执行 Worker (AI SDK + RAG)
packages/
  shared/     — 共享类型、Zod Schema
  db/         — Prisma Schema + 数据库访问
infra/
  docker/     — Docker Compose 配置
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
| Web | 38421 | Next.js 开发服务器 |
| Worker | 38422 | Agent Worker |
| PostgreSQL | 25432 | 数据库（非标准端口避免冲突） |
| Redis | 26379 | 缓存（非标准端口） |
| MinIO API | 29000 | 对象存储 |
| MinIO Console | 29001 | 对象存储管理界面 |

## 文档

| 文档 | 说明 |
|------|------|
| [Kickoff](docs/0-kickoff/kickoff.md) | 项目总纲、核心场景 |
| [PRD](docs/1-requirements/prd.md) | 产品需求文档 |
| [Architecture](docs/2-design/architecture.md) | 技术架构、数据模型、API |
| [Prompt Design](docs/2-design/prompt-design.md) | 苏格拉底式教学 Prompt |
| [Iteration Plan](docs/3-development/iteration-plan.md) | 迭代计划 |
| [Dev Log](docs/dev-log.md) | 开发日志 |

## 技术栈

| 层 | 技术 |
|---|------|
| Web | Next.js 15, React 19, shadcn/ui, Tailwind CSS 4 |
| Agent | AI SDK v4 (streamText + tool calling) |
| LLM | 智谱 GLM（OpenAI 兼容接口） |
| DB | PostgreSQL 16 + pgvector + Prisma ORM |
| Cache | Redis 7 |
| Storage | MinIO (S3 兼容) |
| Runtime | Node.js 20 LTS, TypeScript strict |
| Package Manager | pnpm workspaces |
