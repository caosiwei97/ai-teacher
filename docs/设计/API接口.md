# AI Teacher — API 接口文档

> 版本：v0.8
> 更新日期：2026-05-12
> 状态：已对齐实际实现（含迭代 031 多模型支持 + DeepSeek）

---

## 接口概览

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/api/sessions` | 创建学习会话 | ✅ |
| GET | `/api/sessions` | 获取会话列表（排除已归档） | ✅ |
| GET | `/api/sessions/:id` | 获取会话详情 | ✅ |
| PATCH | `/api/sessions/:id` | 更新会话状态 | ✅ |
| DELETE | `/api/sessions/:id` | 归档会话 | ✅ |
| POST | `/api/chat` | 流式对话（SSE，经 Hono Server） | ✅ |
| POST | `/api/sessions/:id/diagnostic` | 生成诊断题 | ✅ |
| POST | `/api/sessions/:id/diagnostic/evaluate` | 评估诊断答案 | ✅ |
| POST | `/api/quick-question` | 快问（选中文字提问） | ✅ |
| POST | `/api/suggest-reply` | AI 建议回复 | ✅ |
| GET | `/api/suggested-topics` | 获取推荐学习话题 | ✅ |
| POST | `/api/sandbox/execute` | 代码执行（Judge0 沙箱） | ✅ |
| POST | `/api/llm-configs` | 管理用户 LLM 配置 | ✅ |
| GET | `/api/llm-configs` | 获取用户 LLM 配置列表 | ✅ |

> **架构说明**：API 路由已从 Next.js API Routes 迁移到独立 Hono Server（apps/server，端口 38422）。Next.js 仅保留 `/api/chat` 作为 SSE 代理。前端通过 `NEXT_PUBLIC_API_URL` 直接请求 Hono Server。

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
  "sourceId": "string (可选，关联学习资料)"
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
    "status": "diagnosing",
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
  "status": "active | completed | archived"
}
```

### 响应 `200`

```json
{
  "session": {
    "id": "clx...",
    "status": "completed",
    "topic": "React Hooks 原理",
    "messages": [...],
    "roadmap": { ... }
  }
}
```

### 说明

- 用于手动标记会话完成或归档
- Zod 验证 status 只接受 `active`、`completed`、`archived`
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
  ]
}
```

### 响应

SSE 流式响应。流程：`POST /api/chat` → Hono Server 入队 BullMQ Job → Worker 执行 Agent（AI SDK streamText）→ 通过 Redis Pub/Sub 流式推送 SSE 事件。

```
data: {"type":"<event-type>","content":...,"data":...}
```

#### SSE 事件类型

| 事件类型 | 说明 | 数据格式 |
|---------|------|---------|
| `text-delta` | 流式文本片段 | `{ content: string }` |
| `tool-call` | 工具调用开始 | `{ data: { toolName, input } }` |
| `tool-result` | 工具调用结果 | `{ data: { toolName, result } }` |
| `ui-blocks` | 结构化教学组件 | `{ data: { uiBlocks: UIBlock[] } }` |
| `code-push` | 代码推送到编辑器 | `{ data: { code, language, instruction? } }` |
| `ask-question` | 聊天内诊断题 | `{ data: { questions, question, nodeId } }` |
| `roadmap-updated` | 路线图节点状态变更 | `{ data: { nodes: RoadmapNode[] } }` |
| `session-updated` | 会话状态变更 | `{ data: { masteredNodes?, totalNodes?, title?, learningStatus? } }` |
| `error` | 错误 | `{ data: { message } }` |

### 后端副作用（异步持久化）

对话完成后，后端自动：

1. 保存 learner 消息 + tutor 消息到数据库
2. 如果有 `assessMastery` 结果 → 更新节点掌握度和状态
3. 如果掌握度 ≥ 80% → 自动将下一个 `not-started` 节点设为 `in-progress`
4. 如果有 `generateAssessment` → 保存评估卡片到消息 metadata

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

- 基于 `glm-4-flash`，使用苏格拉底式追问风格回答
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
    { "id": "topic-1", "icon": "Brain", "title": "深入理解 JavaScript 闭包" },
    { "id": "topic-2", "icon": "Heart", "title": "认知行为疗法入门与实践" },
    { "id": "topic-3", "icon": "Utensils", "title": "营养学基础：科学搭配三餐" },
    { "id": "topic-4", "icon": "Landmark", "title": "文艺复兴：艺术与科学交汇" },
    { "id": "topic-5", "icon": "MessageSquare", "title": "高效沟通：用逻辑说服他人" },
    { "id": "topic-6", "icon": "TrendingUp", "title": "概率思维：做出更明智的决策" }
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
  "expected_output": "string (可选，期望输出，用于自动判定)"
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
- Judge0 资源限制：CPU 5 秒、内存 256MB、墙钟 10 秒
- 安全检查在 Agent 工具层执行（`execute-code.ts` 的 `DANGEROUS_PATTERNS`），此端点不做安全检查（信任前端传入的用户代码）
- 语言 ID 映射：Python=71, JavaScript=63, Java=62, C++=54, TypeScript=74 等

---

## 错误响应格式

所有接口统一错误格式：

```json
{
  "error": "错误描述",
  "details": { ... }  // 仅 Zod 验证错误时包含
}
```

| HTTP 状态码 | 含义 |
|-------------|------|
| 400 | 请求参数验证失败 |
| 404 | 资源不存在 |
| 409 | 会话状态冲突（如无 roadmap） |
| 500 | LLM 调用失败 |
