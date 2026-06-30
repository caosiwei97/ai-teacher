# AI Teacher — API 接口文档

> 版本：v1.2
> 更新日期：2026-05-23
> 状态：已对齐实际实现（含多 Provider、自动创建会话、env-status 端点）

---

## 接口概览

| 方法   | 路径                                    | 说明                            | 状态 |
| ------ | --------------------------------------- | ------------------------------- | ---- |
| POST   | `/api/sessions`                         | 创建学习会话                    | ✅   |
| GET    | `/api/sessions`                         | 获取会话列表（排除已归档）      | ✅   |
| GET    | `/api/sessions/:id`                     | 获取会话详情                    | ✅   |
| PATCH  | `/api/sessions/:id`                     | 更新会话状态/模式               | ✅   |
| DELETE | `/api/sessions/:id`                     | 归档会话                        | ✅   |
| POST   | `/api/chat`                             | 流式对话（SSE，经 Hono Server） | ✅   |
| POST   | `/api/sessions/:id/diagnostic`          | 生成诊断题                      | ✅   |
| POST   | `/api/sessions/:id/diagnostic/evaluate` | 评估诊断答案                    | ✅   |
| GET    | `/api/sessions/:id/review/due`          | 今日到期复习清单（迭代 051②）   | ✅   |
| POST   | `/api/sessions/:id/review/result`       | 提交复习结果（更新记忆强度）    | ✅   |
| GET    | `/api/sessions/:id/review/summary`      | 薄弱点汇总（错题本）            | ✅   |
| GET    | `/api/sessions/:id/interview/result`    | 面试结果（评分卡/复盘，052②）   | ✅   |
| POST   | `/api/quick-question`                   | 快问（选中文字提问）            | ✅   |
| POST   | `/api/suggest-reply`                    | AI 建议回复                     | ✅   |
| GET    | `/api/suggested-topics`                 | 获取推荐学习话题                | ✅   |
| POST   | `/api/sandbox/execute`                  | 代码执行（OpenSandbox）         | ✅   |
| GET    | `/api/sandbox/files/search`             | 沙箱文件搜索                    | ✅   |
| GET    | `/api/sandbox/files/content`            | 获取文件内容                    | ✅   |
| GET    | `/api/sandbox/files/download`           | 下载文件（原始内容）            | ✅   |
| POST   | `/api/sandbox/files/upload`             | 上传/保存文件                   | ✅   |
| DELETE | `/api/sandbox/files`                    | 删除文件                        | ✅   |
| POST   | `/api/sandbox/directories`              | 创建目录                        | ✅   |
| DELETE | `/api/sandbox/directories`              | 删除目录                        | ✅   |
| POST   | `/api/sandbox/pty`                      | 创建 PTY 终端会话               | ✅   |
| GET    | `/api/sandbox/pty/:sessionId/ws`        | PTY WebSocket 代理              | ✅   |
| POST   | `/api/llm`                              | 创建 LLM 配置                   | ✅   |
| GET    | `/api/llm`                              | 获取用户 LLM 配置列表           | ✅   |
| PATCH  | `/api/llm/:id`                          | 更新 LLM 配置                   | ✅   |
| DELETE | `/api/llm/:id`                          | 删除 LLM 配置                   | ✅   |
| POST   | `/api/llm/:id/test`                     | 测试 LLM 配置连通性             | ✅   |
| GET    | `/api/llm/models`                       | 获取 Provider 预设模型列表      | ✅   |
| POST   | `/api/llm/models/live`                  | 用 API Key 动态拉取可用模型     | ✅   |
| GET    | `/api/chat/:sessionId/stream`           | SSE 流式重连（断线恢复）        | ✅   |
| GET    | `/api/llm/env-status`                   | 检查环境默认 LLM 配置状态       | ✅   |

> **架构说明**：API 路由全部在独立 Hono Server（apps/server，端口 38422）中实现。前端通过 Vite dev server proxy（开发环境）或 `VITE_API_URL` 直接请求 Hono Server。

> 以下为实际已实现的接口详情。

---

## 1. 创建学习会话

```
POST /api/sessions
```

### 请求体

```json
{
  "userId": "string (必填)",
  "topic": "string (必填)",
  "sourceId": "string (可选，关联学习资料)",
  "teachingMode": "warm | strict | interviewer (可选，默认 warm)",
  "llmConfigId": "string (可选，指定使用的用户 LLM 配置)"
}
```

### 响应 `201`

```json
{
  "session": {
    "id": "clx...",
    "userId": "seed-user-ai-teacher",
    "topic": "React Hooks 原理",
    "sourceId": null,
    "status": "active",
    "createdAt": "2026-05-08T...",
    "updatedAt": "2026-05-08T...",
    "roadmap": {
      "id": "clx...",
      "sessionId": "clx...",
      "version": 1,
      "nodes": [
        {
          "id": "clx...",
          "index": 0,
          "title": "useState 的基本用法",
          "description": "理解 useState 的声明方式和更新机制",
          "status": "in-progress",
          "masteryScore": 0
        }
      ]
    }
  }
}
```

### 说明

- `GET /api/sessions` 自动排除 `archived` 状态的会话
- 按会话 `updatedAt` 降序排列
- 响应包含 `source`（关联资料）、`llmConfigId`、`activeMode`（学/固/验模式，迭代 053②）、`progress`（`{ totalNodes, masteredNodes, currentNodeId, currentNodeTitle }`）字段

---

## 3. 获取会话详情

```
GET /api/sessions/:id
```

### 响应 `200`

返回完整会话数据，包含：

- 会话基本信息
- 关联的 Source（学习资料）
- 所有 Message（按时间排序）
- Roadmap + 所有 Node（按 index 排序）
- User + LearnerProfile

---

## 4. 更新会话状态

```
PATCH /api/sessions/:id
```

### 请求体

```json
{
  "status": "active | completed | archived", // 可选，迭代 051 起可选
  "activeMode": "learning | review | interview" // 可选，迭代 051②：切换学/固/验模式
}
```

### 响应 `200`

```json
{
  "session": {
    "id": "clx...",
    "status": "completed",
    "activeMode": "review",
    "topic": "React Hooks 原理",
    "messages": [...],
    "roadmap": { ... }
  }
}
```

### 说明

- 用于手动标记会话完成或归档，或切换当前学习/复习/面试模式（迭代 051②）
- Zod 验证 status 只接受 `active`、`completed`、`archived`；activeMode 只接受 `learning`、`review`、`interview`
- 两个字段均可选，可单独 PATCH（如切换复习模式只传 `activeMode`）
- 当 status 变为 `completed` 时，自动触发学习者画像更新：
  - 从 roadmap 节点中提取已掌握/未掌握知识点
  - 去重合并到用户的 LearnerProfile（strengths/weaknesses/sessionsSummary）
  - 保留最近 10 次会话摘要

---

## 5. 归档会话

```
DELETE /api/sessions/:id
```

### 响应 `200`

```json
{
  "success": true,
  "session": {
    "id": "clx...",
    "status": "archived"
  }
}
```

### 说明

- 软删除：将 session 状态设为 `archived`
- 归档后的会话不会出现在 `GET /api/sessions` 列表中
- 归档后的会话仍可通过 `GET /api/sessions/:id` 直接访问

---

## 6. 流式对话

```
POST /api/chat
```

### 请求体

```json
{
  "sessionId": "string (必填)",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "最新消息" }
  ],
  "hidden": "boolean (可选，默认 false，诊断消息不显示在聊天中)",
  "teachingMode": "warm | strict | interviewer (可选，覆盖会话默认教学模式)",
  "llmConfigId": "string (可选，使用指定的用户 LLM 配置)"
}
```

### 响应

SSE 流式响应。流程：`POST /api/chat` → Hono Server 入队 BullMQ Job → Worker 执行 Agent（AI SDK streamText）→ 通过 Redis Pub/Sub 流式推送 SSE 事件。

```
data: {"type":"<event-type>","content":...,"data":...}
```

#### SSE 事件类型

| 事件类型          | 说明               | 数据格式                                                             |
| ----------------- | ------------------ | -------------------------------------------------------------------- |
| `text-delta`      | 流式文本片段       | `{ content: string }`                                                |
| `tool-call`       | 工具调用开始       | `{ data: { toolName, input } }`                                      |
| `tool-result`     | 工具调用结果       | `{ data: { toolName, result } }`                                     |
| `ui-blocks`       | 结构化教学组件     | `{ data: { uiBlocks: UIBlock[] } }`                                  |
| `code-push`       | 代码推送到编辑器   | `{ data: { code, language, instruction? } }`                         |
| `ask-question`    | 聊天内诊断题       | `{ data: { questions, question, nodeId } }`                          |
| `roadmap-updated` | 路线图节点状态变更 | `{ data: { nodes: RoadmapNode[] } }`                                 |
| `session-updated` | 会话状态变更       | `{ data: { masteredNodes?, totalNodes?, title?, learningStatus? } }` |
| `error`           | 错误               | `{ data: { message } }`                                              |

### 后端副作用（异步持久化）

对话完成后，后端自动：

1. 保存 learner 消息 + tutor 消息到数据库
2. 如果有 `assessMastery` 结果 → 更新节点掌握度和状态
3. 如果掌握度 ≥ 80% → 自动将下一个 `not-started` 节点设为 `in-progress`
4. 如果有 `generateAssessment` → 保存评估卡片到消息 metadata

### 自动创建会话

如果请求中的 `sessionId` 对应的会话不存在，系统会自动创建新会话：

- `topic` = 用户消息内容
- `teachingMode` = 请求参数或 `"warm"`
- 同时创建空的 Roadmap

这一行为允许前端跳过显式的 `POST /api/sessions` 调用，直接发送消息即可开始学习。

---

## 7. 生成诊断题

```
POST /api/sessions/:id/diagnostic
```

### 响应 `200`

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "以下哪个正确描述了 useState 的行为？",
      "type": "multiple_choice",
      "options": ["...", "...", "...", "..."],
      "nodeIndex": 0
    },
    {
      "id": "q2",
      "question": "请简述 useEffect 的清理函数在什么时机执行？",
      "type": "short_answer",
      "nodeIndex": 3
    }
  ]
}
```

### 说明

- 调用 **Diagnostic Agent**（`generateObject` + Zod Schema）
- 生成 3-5 道混合题（选择题 + 简答题）
- 题目覆盖不同 nodeIndex 的知识点

---

## 8. 评估诊断答案

```
POST /api/sessions/:id/diagnostic/evaluate
```

### 请求体

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "type": "multiple_choice",
      "correctAnswer": "B",
      "nodeIndex": 0
    }
  ],
  "answers": [
    {
      "questionId": "q1",
      "answer": "B"
    }
  ]
}
```

### 响应 `200`

```json
{
  "evaluation": {
    "level": "intermediate",
    "startingNodeIndex": 3,
    "reasoning": "用户对基础概念有一定理解..."
  },
  "startingNode": {
    "id": "clx...",
    "index": 3,
    "title": "useEffect 依赖数组"
  }
}
```

### 后端副作用

评估完成后，后端自动更新节点状态：

- `index < startingNodeIndex` 的节点 → `mastered`（masteryScore=100）
- `index === startingNodeIndex` 的节点 → `in-progress`
- 会话状态从 `diagnosing` → `active`

---

## 9. 快问

```
POST /api/quick-question
```

### 请求体

```json
{
  "sessionId": "string (必填)",
  "selectedText": "string (必填，用户选中的文字)",
  "question": "string (必填，用户的问题)",
  "context": "string (可选，额外上下文)"
}
```

### 响应

AI SDK SSE 流式响应。

- 基于 `deepseek-v4-flash`，使用苏格拉底式追问风格回答
- 回答 1-3 句话，聚焦选中内容

### 说明

- 用户在聊天中选中文本后，点击"快问"按钮触发
- 不影响主对话流程，是独立的辅助功能

---

## 10. AI 建议回复

```
POST /api/suggest-reply
```

### 请求体

```json
{
  "sessionId": "string (必填)",
  "currentQuestion": "string (必填，AI 当前问的问题)",
  "topic": "string (可选，学习主题)",
  "hint": "string (可选，提示方向)"
}
```

### 响应 `200`

```json
{
  "suggestion": "可以从 useState 的返回值结构入手，想想数组的两个元素分别代表什么..."
}
```

### 说明

- 用户不知道怎么回答时，点击输入框旁灯泡按钮触发
- 返回的是**思考方向提示**（不是完整答案），帮助用户找到思路
- 使用 `generateText`（非流式），直接返回 JSON

---

## 11. 获取推荐学习话题

```
GET /api/suggested-topics
```

### 响应 `200`

```json
{
  "topics": [
    { "id": "topic-1", "icon": "Brain", "title": "AI 提示词工程" },
    { "id": "topic-2", "icon": "Heart", "title": "用 LangGraph 搭建 AI Agent" },
    { "id": "topic-3", "icon": "TrendingUp", "title": "科学减脂与身材管理" },
    { "id": "topic-4", "icon": "MessageSquare", "title": "情绪管理与压力释放" },
    { "id": "topic-5", "icon": "Brain", "title": "个人投资理财入门" },
    { "id": "topic-6", "icon": "Heart", "title": "自媒体运营与个人品牌" }
  ]
}
```

### 说明

- 首页欢迎页使用的推荐话题列表
- 当前为硬编码，后续可迁移到数据库配置
- `icon` 字段对应 lucide-react 图标名称
- 前端有 fallback 硬编码列表，API 不可用时仍可正常显示

---

## 12. 代码执行（沙箱）

```
POST /api/sandbox/execute
```

### 请求体

```json
{
  "source_code": "string (必填，要执行的代码)",
  "language_id": 71,
  "stdin": "string (可选，标准输入)",
  "expected_output": "string (可选，期望输出，用于自动判定)",
  "llmConfigId": "string (可选，指定使用的 LLM 配置)"
}
```

### 响应 `200`

```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "time": "0.12",
  "memory": 12344,
  "status": "Accepted"
}
```

### 说明

- 前端"编辑并重新运行"按钮直接调用此接口
- Worker 的 `executeCode` Agent 工具也调用同一底层 `submitCode()` 函数
- 沙箱资源限制：CPU 5 秒、内存 256MB、墙钟 10 秒
- 安全检查在 Agent 工具层执行（`execute-code.ts` 的 `DANGEROUS_PATTERNS`），此端点不做安全检查（信任前端传入的用户代码）
- 语言 ID 映射：Python=71, JavaScript=63, Java=62, C++=54, TypeScript=74 等

---

## 12.1 沙箱文件系统

所有文件系统请求通过 Hono Server 代理到 OpenSandbox execd 容器内部，前端不直接访问 execd。

### 文件搜索

```
GET /api/sandbox/files/search?path=/workspace&pattern=**/*
```

响应：execd `/files/search` 的原始 JSON（文件信息数组，含 path/size/mode/mtime）

### 获取文件内容

```
GET /api/sandbox/files/content?path=/workspace/main.py
```

响应 `200`：

```json
{
  "content": "print('hello')\n",
  "path": "/workspace/main.py"
}
```

### 下载文件（原始内容）

```
GET /api/sandbox/files/download?path=/workspace/main.py
```

响应：原始文件内容（text/plain）

### 上传/保存文件

```
POST /api/sandbox/files/upload
Content-Type: multipart/form-data
```

请求体：multipart form，包含文件数据 + 路径

### 删除文件

```
DELETE /api/sandbox/files?path=/workspace/main.py
```

### 创建目录

```
POST /api/sandbox/directories
```

请求体：`{ "path": "/workspace/src" }`

### 删除目录

```
DELETE /api/sandbox/directories?path=/workspace/src
```

---

## 12.2 PTY 交互式终端

### 创建 PTY 会话

```
POST /api/sandbox/pty
```

请求体：`{ "cwd": "/workspace" }`（可选）

响应 `200`：

```json
{
  "session_id": "abc123"
}
```

### WebSocket 终端连接

```
WS /api/sandbox/pty/:sessionId/ws
```

二进制帧协议：

- 发送：`0x00` + UTF-8 编码的 stdin 数据
- 接收：`0x01` + stdout 数据
- 控制帧（JSON）：`{"type":"resize","cols":120,"rows":40}` 或 `{"type":"signal","signal":"SIGINT"}`

Hono Server 双向代理 WebSocket 帧到 execd 容器内的 PTY。

---

## 13. SSE 流式重连

```
GET /api/chat/:sessionId/stream
```

### 说明

- 用于 SSE 断线后重新连接到现有会话的流式通道
- 通过 Redis Pub/Sub 订阅 `chat:{sessionId}` 频道
- 如果会话已有正在执行的 Agent 任务，会接续收到后续 SSE 事件
- 前端通过 Hono Server 的 SSE 流式重连端点恢复连接

---

## 14. LLM 配置管理（完整）

### 14.1 获取配置列表

```
GET /api/llm?userId=...
```

返回用户的所有 LLM 配置（API Key 已脱敏，显示前4后4位）。

### 14.2 创建配置

```
POST /api/llm?userId=...
```

请求体：

```json
{
  "provider": "openai | anthropic | deepseek | qianwen | kimi | minimax | xiaomi | zhipu | custom",
  "apiKey": "string (必填)",
  "baseUrl": "string (可选，自定义 API 端点)",
  "defaultModel": "string (必填)",
  "label": "string (可选，配置显示名称)",
  "isDefault": "boolean (可选，设为默认配置)"
}
```

### 14.3 更新配置

```
PATCH /api/llm/:id?userId=...
```

请求体：同创建，所有字段均可选。

### 14.4 删除配置

```
DELETE /api/llm/:id?userId=...
```

### 14.5 测试配置

```
POST /api/llm/:id/test?userId=...
```

使用指定的 LLM 配置发送测试请求（`generateText` + `prompt:"Hi"` + `maxOutputTokens:5`），验证 API Key 和端点可用性。

**成功响应**：

```json
{ "success": true }
```

**失败响应**（HTTP 仍为 200，业务级失败）：

```json
{
  "success": false,
  "error": "API Key 无效或已过期，请检查密钥",
  "detail": {
    "statusCode": 401,
    "url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "responseBody": "{\"error\":{\"message\":\"...\",\"code\":\"1211\"}}"
  }
}
```

`error` 为中文可读提示，按状态码映射：401/403 → 密钥问题；400 含"模型"→ 模型名错误；404 → Base URL 错误；429 → 限流/额度；5xx → 上游异常；无状态码 → 网络/连接问题。`detail` 透传 `APICallError` 的原始字段，前端展示为主消息 + 可折叠详情。

### 14.6 获取预设模型列表

```
GET /api/llm/models?provider=...
```

返回指定 Provider 的预设模型列表。

```json
{
  "provider": "deepseek",
  "name": "DeepSeek",
  "models": [
    { "id": "deepseek-chat", "name": "DeepSeek Chat" },
    { "id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash" }
  ]
}
```

### 14.7 动态拉取可用模型

```
POST /api/llm/models/live
```

用用户提供的 API Key 调用供应商的 `/models` 端点，返回该账号实际可用的模型 id 列表（OpenAI 兼容格式）。前端用于配置流程中"选择模型"步骤，替代静态预设列表，确保模型名准确且能跟上供应商新模型。拉取失败时前端回退到预设列表（14.6）。

**请求体**：

```json
{ "provider": "zhipu", "apiKey": "sk-xxx", "baseUrl": "" }
```

`baseUrl` 可选，留空时用 `PROVIDER_PRESETS[provider].baseUrl`。

**成功响应**：

```json
{
  "success": true,
  "models": ["glm-4.5", "glm-4.6", "glm-4.7", "glm-5", "glm-5.2"]
}
```

**失败响应**（HTTP 200，业务级失败）：含中文 `error` + `detail`（statusCode/url/responseBody），映射规则同 14.5。前端收到失败后回退静态预设列表并展示警告。

### 14.8 检查环境 LLM 配置状态

```
GET /api/llm/env-status
```

### 响应 `200`

```json
{
  "hasEnvConfig": true,
  "baseUrl": "https://api.deepseek.com"
}
```

### 说明

- 检查环境变量 `OPENAI_API_KEY` 是否已配置
- 前端用于判断是否跳过 LLM 配置步骤（如果系统已有默认配置）
- `hasEnvConfig` 为 `false` 时，引导用户到设置页配置 API Key

---

## 15. 学习资料管理（迭代 009 RAG）

用户上传学习资料（PDF/Markdown）或导入 URL，系统异步解析→分块→embedding→入库（pgvector），Agent 经 retrieve-context 工具检索。资料为用户级全局库，按 userId 隔离。

### 15.1 上传文件

```
POST /api/sources
```

multipart/form-data：

- `userId` — string（必填）
- `file` — 文件（必填，仅 `.pdf` / `.md`，≤50MB）

PDF 原始文件存 MinIO（`Source.fileUrl` = 对象 key，`checksum` = sha256）；Markdown 文本存 `Source.content`。创建后入 `source-processing` 队列异步处理。

响应 `201`：

```json
{
  "source": {
    "id": "...",
    "userId": "...",
    "title": "...",
    "type": "pdf|markdown",
    "content": null,
    "fileUrl": "sources/{id}/{file}",
    "checksum": "sha256...",
    "status": "pending",
    "createdAt": "ISO"
  }
}
```

### 15.2 导入 URL

```
POST /api/sources/url
```

请求体：

```json
{ "userId": "string (必填)", "url": "string (必填，合法 URL)" }
```

经 Jina Reader 抓取解析为 Markdown（`Source.type=markdown`，`fileUrl`=原始 URL），入队异步处理。响应 `201`：同 15.1。

### 15.3 列出资料

```
GET /api/sources?userId=...
```

响应 `200`：`{ "sources": SourceRecord[] }`（按 `createdAt` 倒序）。

### 15.4 删除资料

```
DELETE /api/sources/:sourceId?userId=...
```

级联删除 `DocumentChunk`；若 `fileUrl` 为 MinIO 对象（非 http）则清理存储。响应 `200`：`{ "ok": true }`。

### 状态机

`Source.status`：`pending`（已入队）→ `processing`（解析/embedding 中）→ `ready`（可检索）/ `failed`（处理失败）。

---

## 16. 复习模式（迭代 051②）

复习模式 API，挂载于 `/api/sessions/:sessionId/review`。间隔重复算法（`applyReviewResult`）+ 数据服务（`ReviewService`）位于 `packages/shared/src/services/`，server 与 worker 共用。

### 16.1 今日到期复习清单

```
GET /api/sessions/:sessionId/review/due
```

#### 响应 `200`

```json
{
  "dueNodes": [
    {
      "id": "clx...",
      "index": 0,
      "title": "useState",
      "description": "状态钩子",
      "memoryStrength": 1.0,
      "lastReviewedAt": null,
      "nextReviewAt": null,
      "reviewInterval": 1,
      "isOverdue": true
    }
  ]
}
```

#### 说明

- 返回 mastered 且间隔重复到期（`nextReviewAt` 为 null/逾期）的知识点（spec §3.1 智能推荐）
- `isOverdue=true` 表示从未复习/老数据，进入复习模式优先呈现

### 16.2 提交复习结果

```
POST /api/sessions/:sessionId/review/result
```

#### 请求体

```json
{
  "nodeId": "clx...",
  "correct": true
}
```

#### 响应 `200`

```json
{
  "result": {
    "nodeId": "clx...",
    "title": "useState",
    "memoryStrength": 1.0,
    "lastReviewedAt": "2026-06-29T12:00:00.000Z",
    "nextReviewAt": "2026-07-01T12:00:00.000Z",
    "reviewInterval": 2,
    "trend": "维持"
  }
}
```

#### 说明

- 抽认卡自评入口（学习者翻面后 UI 提交）；回忆测验由考官 agent 调 `recordReviewResult` 工具走同一 `ReviewService.submitResult`
- 答对间隔翻倍（1→2→4→8→16→32d 封顶），答错重置 1d；记忆强度 +0.15/-0.3（spec §3.3/§9.2）
- `trend`：强化（答对且强度上升）/ 维持（答对已封顶）/ 衰退（答错）
- 节点不存在 → `404`

### 16.3 薄弱点汇总

```
GET /api/sessions/:sessionId/review/summary
```

#### 响应 `200`

```json
{
  "summary": {
    "totalMastered": 3,
    "weakNodes": [
      {
        "id": "clx...",
        "title": "useMemo",
        "memoryStrength": 0.2,
        "reviewInterval": 1,
        "lastReviewedAt": "2026-06-29T12:00:00.000Z"
      }
    ]
  }
}
```

#### 说明

- 薄弱点 = mastered 且 `memoryStrength < 0.6`，按强度升序（spec §3.3 错题本，可一键转回学习模式重学）

---

## 17. 面试模式（迭代 052②）

面试模式 API，挂载于 `/api/sessions/:sessionId/interview`。评分算法（`adjustDifficulty`/`computeTotalScore`）+ 数据服务（`InterviewService`）位于 `packages/shared/src/services/`。面试流程由面试官 agent（chat-turn `activeMode=interview` 分流）驱动，本 API 仅查询结果。

### 17.1 查询面试结果

```
GET /api/sessions/:sessionId/interview/result
```

#### 响应 `200`

```json
{
  "result": {
    "id": "clx...",
    "sessionId": "clx...",
    "status": "completed",
    "difficulty": "medium",
    "streak": 0,
    "totalScore": 75,
    "questionLog": [
      {
        "question": "...",
        "answer": "...",
        "score": 80,
        "isCorrect": true,
        "difficulty": "medium",
        "feedback": "..."
      }
    ],
    "weakPoints": ["闭包", "this 绑定"],
    "improvement": "多练基础概念...",
    "createdAt": "2026-06-29T..."
  }
}
```

#### 说明

- 返回最新面试记录（in_progress 或 completed）；无记录 → `result: null`
- 评分卡/复盘由 agent 调 `finalizeInterview` 后产 `interviewScore` block 呈现；本接口供 UI 持久展示
- `totalScore` = 各题 score 平均（`computeTotalScore`）；`difficulty`/`streak` 由 `scoreAnswer` 动态调整

---

## 错误响应格式

所有接口统一错误格式：

```json
{
  "error": "错误描述",
  "details": { ... }  // 仅 Zod 验证错误时包含
}
```

| HTTP 状态码 | 含义                         |
| ----------- | ---------------------------- |
| 400         | 请求参数验证失败             |
| 404         | 资源不存在                   |
| 409         | 会话状态冲突（如无 roadmap） |
| 500         | LLM 调用失败                 |
