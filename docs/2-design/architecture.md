# AI Teacher — 技术架构设计

> 版本：v0.1
> 日期：2026-05-08
> 状态：初始草稿

---

## 1. 技术栈

| 层 | 技术 | 理由 |
|---|------|------|
| Runtime | Node.js 20 LTS, TypeScript strict | 与 OpenAgent 一致，生态成熟 |
| Web | Next.js 15 (App Router), React 19 | SSR + API Routes 一体化 |
| UI | shadcn/ui + Tailwind CSS 4 | 快速开发，三栏布局 |
| Agent | AI SDK v4 (streamText + tool calling) | 成熟的 Agent Loop，流式输出 |
| LLM | OpenAI GPT-4o / Claude | 主力推理模型 |
| Embedding | text-embedding-3-small | 资料向量化 |
| DB | PostgreSQL 16 + Prisma ORM | 结构化数据 + 向量检索 |
| Cache | Redis 7 | 会话状态 + 对话缓存 |
| 存储 | MinIO (S3 兼容) | 用户上传的文件存储 |
| 容器 | Docker Compose | 一键启动所有服务 |

---

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
  │  │   Next.js    │  │   Worker    │  │   PostgreSQL 16  │ │
  │  │   :38421     │  │   :38422    │  │   :25432         │ │
│  │              │  │             │  │                  │ │
│  │  - Chat UI   │  │ - Agent     │  │  - sessions      │ │
│  │  - API       │  │   Loop      │  │  - messages      │ │
│  │  - SSE       │  │ - RAG       │  │  - roadmaps      │ │
│  │              │  │ - Embedding │  │  - sources       │ │
│  └──────┬───────┘  └──────┬──────┘  │  - learner_      │ │
│         │                 │         │    profiles      │ │
│         │    ┌────────┐   │         └──────────────────┘ │
  │         └───►│ Redis  │◄──┘                              │
  │              │ :26379 │                                  │
  │              │        │  ┌──────────────────────────┐   │
  │              │        │  │   MinIO :29000            │   │
│              └────────┘  │   (文件存储)              │   │
│                          └──────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 模块设计

### 3.1 项目结构

```
ai-teacher/
├── apps/
│   ├── web/                    # Next.js App Router
│   │   ├── app/
│   │   │   ├── page.tsx        # 首页（上传资料/开始学习）
│   │   │   ├── learn/
│   │   │   │   └── [sessionId] # 学习对话页（三栏布局）
│   │   │   ├── api/
│   │   │   │   ├── chat/       # SSE 流式对话
│   │   │   │   ├── sessions/   # 会话 CRUD
│   │   │   │   ├── sources/    # 资料上传/管理
│   │   │   │   └── roadmap/    # 知识图谱
│   │   │   └── history/        # 会话历史
│   │   ├── components/
│   │   │   ├── chat/           # 对话组件
│   │   │   ├── roadmap/        # 知识图谱可视化
│   │   │   ├── session/        # 会话管理
│   │   │   └── ui/             # shadcn/ui 基础组件
│   │   └── lib/
│   │       └── api-client.ts   # API 客户端
│   └── worker/                 # Agent 执行 Worker
│       └── src/
│           ├── agent/          # Agent Loop
│           │   ├── tutor.ts    # 苏格拉底追问 Agent
│           │   ├── assessor.ts # 诊断/评估 Agent
│           │   ├── roadmap.ts  # 知识图谱生成
│           │   └── prompts/    # Prompt 模板
│           ├── rag/            # RAG 检索
│           │   ├── embed.ts    # 文档嵌入
│           │   ├── chunk.ts    # 文档分块
│           │   └── retrieve.ts # 相似度检索
│           └── queue/          # BullMQ 任务处理
├── packages/
│   ├── shared/                 # 共享类型、Zod Schema
│   └── db/                     # Prisma Schema + 数据库访问
├── infra/
│   └── docker/
│       └── docker-compose.yml  # 一键启动
└── docs/                       # 项目文档
```

### 3.2 Agent 架构

#### 苏格拉底追问 Agent（核心）

参考 Sigma Skill 的教学 Prompt 设计：

```typescript
// Agent Loop 核心
const tutorAgent = {
  // 系统提示词：苏格拉底式教学规则
  systemPrompt: `
    你是一个 1v1 私教。核心规则：
    1. 绝不直接给答案
    2. 顺着用户的回答追问，暴露理解漏洞
    3. 用户答偏了 → 不批评，换个角度引导
    4. 用户坦诚不清楚 → 直接讲，不带评判
    5. 追问 2-3 轮后总结，确认理解正确才放行
    
    当前教学上下文：
    - 学习主题：{topic}
    - 当前节点：{currentNode}
    - 学习者画像：{learnerProfile}
    - 已掌握节点：{masteredNodes}
    - 相关资料片段：{ragContext}
  `,

  // 工具集
  tools: {
    assessMastery,    // 评估掌握度
    recordStrength,   // 记录擅长项
    recordMisconception, // 记录误解
    generateAssessment, // 生成评估卡片
    advanceNode,      // 推进到下一节点
  }
}
```

#### 诊断 Agent

```typescript
const assessorAgent = {
  systemPrompt: `
    通过 3-5 个问题快速判断用户水平。
    混合选择题和简答题，从宽到窄。
  `,
  tools: {
    generateQuiz,
    evaluateAnswers,
    determineStartingNode,
  }
}
```

#### 知识图谱生成 Agent

```typescript
const roadmapAgent = {
  systemPrompt: `
    根据学习资料或主题，分解为 5-15 个原子知识点。
    按依赖关系排序，生成线性学习路径。
    每个节点包含：标题、描述、依赖关系。
  `,
  output: RoadmapSchema, // Zod Schema 约束输出
}
```

### 3.3 RAG 流程

```
用户上传 PDF/Markdown
  → 文档解析（提取文本）
  → 分块（Chunk，每块 500-1000 token，重叠 100 token）
  → 向量化（text-embedding-3-small）
  → 存入 PostgreSQL (pgvector)

教学时：
  → 当前节点 + 用户回答 → 构造查询
  → 向量检索 top-k 相关片段
  → 注入 Agent system prompt 作为参考资料
```

### 3.4 掌握度评分

每轮对话后，Agent 输出结构化评估：

```typescript
const MasteryAssessment = z.object({
  conceptId: z.string(),
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()),     // 擅长点
  gaps: z.array(z.string()),          // 盲区
  misconceptions: z.array(z.object({  // 误解
    belief: z.string(),                // 错误认知
    rootCause: z.string(),             // 根因
    resolved: z.boolean(),
  })),
  selfAssessment: z.enum(['solid', 'mostly', 'shaky', 'lost']).optional(),
});
```

---

## 4. 数据模型

### 4.1 Prisma Schema 概要

```prisma
model User {
  id        String    @id @default(cuid())
  name      String
  sessions  Session[]
  sources   Source[]
  profile   LearnerProfile?
  createdAt DateTime  @default(now())
}

model Source {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String
  type      String   // pdf | markdown | url
  content   String?  // 解析后的文本内容
  fileUrl   String?  // MinIO 文件 URL
  checksum  String?  // 文件哈希
  sessions  Session[]
  createdAt DateTime @default(now())
}

model Session {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  topic       String
  sourceId    String?
  source      Source?   @relation(fields: [sourceId], references: [id])
  status      String    @default("active") // active | completed | archived
  roadmap     Roadmap?
  messages    Message[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Roadmap {
  id        String   @id @default(cuid())
  sessionId String   @unique
  session   Session  @relation(fields: [sessionId], references: [id])
  nodes     Node[]
  version   Int      @default(1)
}

model Node {
  id          String   @id @default(cuid())
  roadmapId   String
  roadmap     Roadmap  @relation(fields: [roadmapId], references: [id])
  index       Int      // 排序
  title       String
  description String
  status      String   @default("not-started") // not-started | in-progress | mastered
  masteryScore Int     @default(0)             // 0-100
  reviewLog   Json?    // 评估回顾数据
  masteredAt  DateTime?
}

model Message {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id])
  role      String   // tutor | learner | system
  type      String   // text | quiz | quiz_response | assessment | system
  content   String
  metadata  Json?    // 结构化数据（评估卡片、选择题等）
  createdAt DateTime @default(now())
}

model LearnerProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  learningStyle   Json?    // 学习偏好
  strengths       Json?    // 擅长领域
  weaknesses      Json?    // 薄弱领域
  misconceptionPatterns Json? // 常见误解模式
  sessionsSummary Json?    // 历史学习摘要
  updatedAt       DateTime @updatedAt
}
```

---

## 5. API 设计

### 5.1 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/sessions | 创建学习会话 |
| GET | /api/sessions | 获取会话列表 |
| GET | /api/sessions/:id | 获取会话详情（含消息） |
| POST | /api/chat | 流式对话（SSE） |
| GET | /api/roadmap/:sessionId | 获取知识图谱 |
| POST | /api/sources | 上传学习资料 |
| GET | /api/sources | 获取资料列表 |
| DELETE | /api/sources/:id | 删除资料 |
| GET | /api/profile | 获取学习者画像 |

### 5.2 SSE 流式对话

```
POST /api/chat
Body: { sessionId, message }
Response: SSE stream
  → data: { type: "text", content: "..." }
  → data: { type: "assessment", ... }
  → data: { type: "node_update", nodeId, status, score }
  → data: { type: "done" }
```

---

## 6. Docker Compose

```yaml
# 一键启动：docker compose up -d
# 数据目录：./data/（可后续通过 .env 或配置文件修改）
services:
  web:
    build: .
    ports: ["3000:3000"]
    depends_on: [postgres, redis, minio]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ai_teacher
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin

  worker:
    build: .
    command: npm run dev:worker
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ai_teacher
      - REDIS_URL=redis://redis:6379

  postgres:
    image: pgvector/pgvector:pg16
    ports: ["25432:5432"]
    environment:
      POSTGRES_DB: ai_teacher
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["26379:6379"]
    volumes:
      - ./data/redis:/data

  minio:
    image: minio/minio
    ports: ["29000:9000", "29001:9001"]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - ./data/minio:/data
```

> **数据挂载说明**：所有中间件数据挂载到项目根目录下的 `./data/`，结构如下：
> ```
> data/
> ├── postgres/    # PostgreSQL 数据文件
> ├── redis/       # Redis 持久化文件
> └── minio/       # MinIO 对象存储文件
> ```
> `data/` 已加入 `.gitignore`，不会提交到仓库。后续可通过环境变量或配置文件切换到外部存储路径。

---

## 7. 开发环境

```bash
# 一键启动所有服务
docker compose up -d

# 本地开发（热更新）
npm run dev:web      # Next.js :3000
npm run dev:worker   # Worker :4000

# 数据库
npm run db:generate  # 生成 Prisma Client
npm run db:migrate   # 应用迁移
```
