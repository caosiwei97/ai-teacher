# AI Teacher — API 接口文档

> 版本：v0.2
> 更新日期：2026-05-08
> 状态：已对齐实际实现

---

## 接口概览

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/api/sessions` | 创建学习会话 | ✅ |
| GET | `/api/sessions` | 获取会话列表（排除已归档） | ✅ |
| GET | `/api/sessions/:id` | 获取会话详情 | ✅ |
| PATCH | `/api/sessions/:id` | 更新会话状态 | ✅ |
| DELETE | `/api/sessions/:id` | 归档会话 | ✅ |
| POST | `/api/chat` | 流式对话（SSE） | ✅ |
| POST | `/api/sessions/:id/diagnostic` | 生成诊断题 | ✅ |
| POST | `/api/sessions/:id/diagnostic/evaluate` | 评估诊断答案 | ✅ |

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

AI SDK `DataDataStreamResponse`（SSE 流式响应），包含：

- 文本流（苏格拉底式教学回复）
- 工具调用结果（assessMastery / generateAssessment 等）

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
