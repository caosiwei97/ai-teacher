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

| 命令                 | 说明                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| `pnpm bootstrap`     | 一键初始化：配置环境变量 → 启动中间件 → 生成 Prisma Client → 迁移数据库 |
| `pnpm dev`           | 并行启动 Web（:38421）+ Server（:38422）+ Worker（:38423）              |
| `pnpm docker:up`     | 启动所有中间件（PostgreSQL、Redis、MinIO）                              |
| `pnpm docker:down`   | 停止所有中间件                                                          |
| `pnpm build`         | 构建所有包                                                              |
| `pnpm db:generate`   | 生成 Prisma Client                                                      |
| `pnpm db:migrate`    | 执行数据库迁移                                                          |
| `pnpm db:seed`       | 执行种子数据                                                            |
| `pnpm test:unit`     | 运行单元测试（Vitest）                                                  |
| `pnpm test:coverage` | 单元测试覆盖率报告                                                      |
| `pnpm test:e2e`      | 运行 E2E 测试                                                           |
| `pnpm lint`          | ESLint 检查（含自定义 no-default-export 规则）                          |
| `pnpm check:deps`    | 模块依赖方向检查                                                        |
| `pnpm check:docs`    | 文档-代码一致性检查                                                     |

### Docker 镜像加速（国内用户）

如果 `pnpm bootstrap` 中 Docker 拉取镜像缓慢或失败，需配置 Docker 镜像加速源。

请参考 [dongyubin/DockerHub](https://github.com/dongyubin/DockerHub) 获取当前可用的国内镜像源列表，按其中的教程配置 `registry-mirrors`。

## 项目结构

```
apps/
  web/        — Vite + React 19 SPA (Chat UI，纯前端)
  server/     — Hono API Server (REST API + SSE)
  worker/     — Agent Worker (BullMQ 队列消费 + AI SDK streamText + 11 tools)
packages/
  shared/     — 共享类型、Zod Schema
  db/         — Prisma Schema + 数据库访问
docs/         — 项目文档
data/         — 本地数据存储（已加入 .gitignore）
```

## 本地数据存储

```
data/
├── postgres/    # PostgreSQL 数据文件
├── redis/       # Redis 持久化文件
├── redis-judge0/  # Judge0 Redis（历史遗留，已迁移至 OpenSandbox）
└── minio/       # MinIO 对象存储文件
```

所有数据通过 Docker volume bind-mount 存储在本地 `./data/` 目录，可通过 `.env` 修改挂载路径。

## 服务端口

| 服务          | 端口  | 说明                              |
| ------------- | ----- | --------------------------------- |
| Web           | 38421 | Vite 开发服务器（纯前端）         |
| API Server    | 38422 | Hono API Server                   |
| Worker        | 38423 | BullMQ Worker（Agent 执行）       |
| PostgreSQL    | 25432 | 数据库（非标准端口避免冲突）      |
| Redis         | 26379 | 缓存（非标准端口）                |
| MinIO API     | 29000 | 对象存储                          |
| MinIO Console | 29001 | 对象存储管理界面                  |
| OpenSandbox   | 2358  | 代码执行沙箱（Docker 镜像内运行） |

## 文档

| 文档                                   | 说明                         |
| -------------------------------------- | ---------------------------- |
| [产品定位](docs/产品/产品定位.md)      | 项目总纲、核心场景、约束边界 |
| [技术架构](docs/设计/技术架构.md)      | 技术栈、系统架构、数据模型   |
| [API 接口](docs/设计/API接口.md)       | 已实现的接口文档             |
| [Prompt 设计](docs/设计/Prompt设计.md) | 苏格拉底式教学 Prompt        |
| [决策记录](docs/设计/决策记录.md)      | 关键技术决策及原因           |
| [迭代计划](docs/开发/迭代计划.md)      | 41 个迭代、状态、进度        |
| [开发日志](docs/开发/开发日志.md)      | 开发时间线记录               |
| [E2E 测试](docs/测试/e2e/README.md)    | 测试用例矩阵                 |

## 技术栈

| 层              | 技术                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Web             | Vite 8, React 19, shadcn/ui, Tailwind CSS 4, Monaco Editor                                     |
| Agent           | AI SDK v6 (streamText + tool calling)                                                          |
| LLM             | 多 Provider（@ai-sdk/deepseek + @ai-sdk/openai + @ai-sdk/anthropic），默认 `deepseek-v4-flash` |
| DB              | PostgreSQL 16 + pgvector + Prisma ORM                                                          |
| Cache           | Redis 7                                                                                        |
| Storage         | MinIO (S3 兼容)                                                                                |
| Runtime         | Node.js 20 LTS, TypeScript strict                                                              |
| Testing         | Vitest 4（单元测试）+ Playwright（E2E）                                                        |
| Linting         | ESLint 10 + typescript-eslint（自定义 no-default-export 规则 + 自定义依赖方向检查）            |
| Package Manager | pnpm workspaces                                                                                |
