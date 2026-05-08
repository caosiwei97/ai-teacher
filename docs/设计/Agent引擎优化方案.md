# Agent 引擎优化方案

> 版本：v0.1
> 日期：2026-05-08
> 状态：方案设计阶段

---

## 1. 现状分析

### 1.1 当前架构

```
chat/route.ts (293 行, 上帝函数)
  ├── HTTP 请求解析
  ├── Prisma 查询（session + nodes + profile）
  ├── 调用 streamTutorResponse()
  │     └── streamText({ model, system, messages, tools, maxSteps: 3 })
  │           └── 5 个 passthrough tools（只返回 { success: true, ...params }）
  ├── void persistChatTurn()（异步不等待）
  │     ├── await result.text + result.toolResults
  │     ├── 按 toolName 字符串匹配解析工具结果
  │     ├── prisma.$transaction 写入消息 + 更新节点
  │     └── 自动推进下一个节点
  └── return result.toDataStreamResponse()
```

### 1.2 核心问题

| # | 问题 | 严重度 | 来源 |
|---|------|--------|------|
| P1 | **工具不执行真实逻辑** — 5 个 tool 的 execute 只是 passthrough，副作用散落在 route.ts | 高 | 架构缺陷 |
| P2 | **无上下文管理** — 消息全量传给 LLM，无截断/摘要，长对话必然崩 | 高 | 缺失功能 |
| P3 | **无错误恢复** — LLM 调用失败直接 crash，无重试/降级 | 高 | 缺失功能 |
| P4 | **3 个 Agent 无共享基础设施** — 各自创建 provider、定义 prompt、无生命周期管理 | 中 | 架构缺陷 |
| P5 | **持久化逻辑在 API 层** — route.ts 293 行混合 HTTP/DB/Agent 逻辑 | 中 | 耦合问题 |
| P6 | **无 prompt 模板管理** — system prompt 是字符串拼接，难以维护和 A/B 测试 | 低 | 技术债 |

---

## 2. 研究参考

### 2.1 四个仓库对比

| 维度 | Open Agents (Vercel) | Pi Framework | Hermes Agent | OpenClaw |
|------|---------------------|--------------|-------------|----------|
| **核心循环** | AI SDK `ToolLoopAgent` | 双层 while 循环 | 同步 while + IterationBudget | Gateway 路由 |
| **工具执行** | 12 个工具 + 子 Agent 委派 | 并行/按工具配置 | 并行 + 安全层级（8 线程） | MCP + 技能系统 |
| **上下文管理** | 80KB 驱逐 + 缓存控制 | transformContext 钩子 | 压缩中间轮次（保护首尾） | 无公开细节 |
| **错误恢复** | 子 Agent 步数限制 | LLM 错误→优雅退出 | 5 层恢复（重试→降级） | Provider 故障链 |
| **状态管理** | prepareCall/prepareStep | AgentState + 事件规约 | 单类 14000 行 | WebSocket 状态 |
| **可借鉴度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

### 2.2 关键洞察

**Open Agents 最值得参考**：
- 项目本身就是 TypeScript + AI SDK v4，技术栈完全匹配
- `ToolLoopAgent` 就是 `streamText` + `maxSteps` 的高级封装
- `prepareCall`/`prepareStep` 生命周期钩子是优雅的扩展点
- 子 Agent 隔离模式适合未来扩展（如练习 Agent、评估 Agent）

**Pi Framework 值得参考**：
- `beforeToolCall`/`afterToolCall` 钩子——解决了我们的 P1（工具副作用）
- `transformContext` 钩子——解决了我们的 P2（上下文管理）
- AgentMessage ≠ LLM Message 的分层设计

**Hermes 过于重量级**：
- 14000 行单类、Python 实现、5 层错误恢复——对 MVP 教育产品来说过度
- 但"压缩中间轮次"和"注入用户消息保缓存前缀"的思路值得借鉴

**OpenClaw 不太相关**：
- 是 IM 助手框架，重点在多平台接入，Agent Loop 不是核心创新

---

## 3. 目标架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────┐
│                  apps/web/api/                    │
│  chat/route.ts  ──── 轻量 HTTP 层                │
│       │       诊断/会话/资料 等 route             │
│       └── 调用 Agent Engine                      │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              apps/worker/src/agent/               │
│                                                   │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ AgentEngine  │  │ PromptManager             │  │
│  │ (统一入口)    │  │ (模板 + 变量注入)          │  │
│  └──────┬───────┘  └──────────────────────────┘  │
│         │                                         │
│  ┌──────▼───────────────────────────────────┐    │
│  │         BaseAgent (抽象基类)              │    │
│  │  - provider 创建/管理                     │    │
│  │  - lifecycle hooks (beforeCall/afterCall) │    │
│  │  - context management (transformMessages) │    │
│  │  - error recovery (retry + fallback)      │    │
│  └──────┬──────────┬──────────┬─────────────┘    │
│         │          │          │                    │
│  ┌──────▼───┐ ┌────▼─────┐ ┌▼──────────┐        │
│  │TutorAgent│ │Roadmap   │ │Diagnostic │        │
│  │(stream   │ │Agent     │ │Agent      │        │
│  │ Text)    │ │(generate │ │(generate  │        │
│  │          │ │ Object)  │ │ Object)   │        │
│  └────┬─────┘ └──────────┘ └───────────┘        │
│       │                                          │
│  ┌────▼──────────────────────────────────────┐  │
│  │         ToolRegistry                      │  │
│  │  - 工具注册 + 类型安全                      │  │
│  │  - beforeExecute / afterExecute 钩子       │  │
│  │  - 副作用在 afterExecute 中执行             │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.2 核心抽象

```typescript
// === BaseAgent ===
interface AgentConfig {
  model: string;
  maxRetries?: number;
  fallbackModel?: string;
  maxSteps?: number;
}

interface AgentContext {
  sessionId: string;
  userId: string;
  topic: string;
  currentNode: NodeInfo;
  allNodes: NodeInfo[];
  masteredNodes: string[];
  learnerProfile: string;
}

abstract class BaseAgent<TInput, TOutput> {
  protected provider: OpenAIProvider;
  protected config: AgentConfig;

  constructor(config: AgentConfig);

  // 生命周期钩子
  protected beforeCall(input: TInput, context: AgentContext): void;
  protected afterCall(output: TOutput, context: AgentContext): void;

  // 上下文管理
  protected transformMessages(messages: Message[]): Message[];

  // 错误恢复
  protected executeWithRetry(fn: () => Promise<TOutput>): Promise<TOutput>;

  // 抽象方法
  abstract run(input: TInput, context: AgentContext): Promise<TOutput>;
}

// === ToolRegistry ===
interface ToolDefinition<TParams, TResult> {
  name: string;
  description: string;
  parameters: ZodSchema<TParams>;
  execute: (params: TParams, context: AgentContext) => Promise<TResult>;
  beforeExecute?: (params: TParams) => TParams | null; // null = 阻止执行
  afterExecute?: (params: TParams, result: TResult) => void; // 副作用在这里
}
```

### 3.3 工具副作用从 API 层移到工具内

**当前**（P1 问题）：
```
chat/route.ts → streamText() → tool 返回 { success: true } → persistChatTurn() 解析 toolResults 写 DB
```

**目标**：
```
TutorAgent.run() → streamText() → tool.execute() 内部完成真实操作
  - assessMastery: 更新节点掌握度 + 自动推进下一节点
  - generateAssessment: 生成评估数据（纯数据，无副作用）
  - advanceNode: 推进节点状态
  - recordStrength/recordMisconception: 记录到 LearnerProfile
```

**关键**：工具的 `execute` 函数接收 `AgentContext`（含 prisma 或 service），在内部完成 DB 操作。`afterExecute` 钩子用于日志/通知。

---

## 4. 具体优化项与优先级

### 4.1 Phase 1：基础框架（优先级 P0）

| 编号 | 优化项 | 参考 | 文件 |
|------|--------|------|------|
| E-01 | 创建 `BaseAgent` 抽象基类 | Pi + Open Agents | `worker/src/agent/base-agent.ts` |
| E-02 | 统一 Provider 创建（去掉重复 3 处） | Open Agents | `worker/src/agent/provider.ts` |
| E-03 | `PromptManager` 模板管理 | Open Agents | `worker/src/agent/prompts/manager.ts` |
| E-04 | 工具副作用内化（execute 做真实操作） | Pi (afterExecute) | `worker/src/agent/tools/*.ts` |
| E-05 | `chat/route.ts` 瘦身（移除 persistChatTurn） | 整洁架构 | `web/src/app/api/chat/route.ts` |

### 4.2 Phase 2：上下文管理（优先级 P0）

| 编号 | 优化项 | 参考 | 文件 |
|------|--------|------|------|
| E-06 | `MessageTransformer` 消息截断 | Hermes (压缩中间轮次) | `worker/src/agent/context.ts` |
| E-07 | Token 预算估算（估算后再决定是否截断） | Hermes (preflight) | `worker/src/agent/context.ts` |
| E-08 | 历史消息摘要（超过阈值时摘要中间轮次） | Hermes (context compressor) | `worker/src/agent/context.ts` |

### 4.3 Phase 3：错误恢复（优先级 P1）

| 编号 | 优化项 | 参考 | 文件 |
|------|--------|------|------|
| E-09 | LLM 调用重试（指数退避，最多 3 次） | Hermes (retry) | `worker/src/agent/base-agent.ts` |
| E-10 | Fallback 模型（glm-4-flash → fallback 模板） | Hermes (fallback chain) | `worker/src/agent/provider.ts` |
| E-11 | 流式响应超时检测 | Hermes (90s stale) | `worker/src/agent/base-agent.ts` |

### 4.4 Phase 4：高级特性（优先级 P2）

| 编号 | 优化项 | 参考 | 文件 |
|------|--------|------|------|
| E-12 | 生命周期钩子（beforeCall/afterCall/prepareStep） | Open Agents | `worker/src/agent/base-agent.ts` |
| E-13 | 子 Agent 模式（练习 Agent、评估 Agent） | Open Agents (subagent) | `worker/src/agent/subagents/` |
| E-14 | 事件系统（AgentEvent → 前端实时状态） | Pi (EventStream) | `worker/src/agent/events.ts` |

---

## 5. 不采纳的模式

| 模式 | 来源 | 不采纳原因 |
|------|------|-----------|
| IterationBudget（迭代预算） | Hermes | 过度设计。教学场景每次对话 1-3 轮工具调用，不需要预算管理 |
| 并行工具执行 | Hermes/Pi | 教学场景工具调用有严格顺序（assess → generateAssessment → advance），不能并行 |
| 凭证池轮换 | Hermes | 单用户 MVP，不需要多 API Key 轮换 |
| Skill 系统（Markdown 技能） | Open Agents | 教学模块不是技能，是知识图谱节点，已有 Roadmap 管理 |
| 插件系统 | Hermes | MVP 阶段不需要运行时插件 |
| 双层消息队列（steering/follow-up） | Pi | 教学场景不需要中途干预 Agent，用户通过对话自然引导 |
| 多传输层适配 | Hermes | 只用智谱 OpenAI 兼容接口，不需要适配 Anthropic/Bedrock |
| 后台记忆审查 | Hermes | 跨会话记忆是迭代 011 的范畴，不在引擎重构范围内 |

---

## 6. 迁移路径

### Step 1：基础设施（不破坏现有功能）

1. 创建 `provider.ts` — 统一 provider 创建
2. 创建 `base-agent.ts` — BaseAgent 抽象基类
3. 让 RoadmapAgent 和 DiagnosticAgent 继承 BaseAgent（最小改动验证）

### Step 2：工具副作用内化

4. 改造 5 个 tool 的 `execute` 函数，接收 service 层完成真实操作
5. 创建 `NodeService` 封装节点操作（掌握度更新、自动推进）
6. 瘦身 `chat/route.ts`，移除 `persistChatTurn`

### Step 3：上下文管理

7. 实现 `transformMessages` — 消息截断策略
8. 实现 token 预算估算
9. （可选）历史消息摘要

### Step 4：错误恢复

10. 在 BaseAgent 中实现 `executeWithRetry`
11. 配置 fallback 模型

### Step 5：高级特性（按需）

12. 生命周期钩子
13. 子 Agent 模式（练习 Agent）

---

## 7. 与迭代计划的关系

本方案应作为新的迭代条目插入迭代计划。建议：

- **迭代 011**：Agent 引擎重构 Phase 1（基础框架 + 工具副作用内化）
- **迭代 012**：Agent 引擎重构 Phase 2（上下文管理 + 错误恢复）
- 原迭代 011（学习者画像）→ 顺延为迭代 013
- 原迭代 012（快问 + AI 建议回复）→ 顺延为迭代 014

---

## 8. 参考仓库

| 仓库 | 星标 | 语言 | 主要参考点 |
|------|------|------|-----------|
| [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents) | — | TypeScript | ToolLoopAgent、prepareCall/prepareStep、子 Agent 模式 |
| [earendil-works/pi](https://github.com/earendil-works/pi) | — | TypeScript | 双层循环、beforeToolCall/afterToolCall、transformContext |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | — | Python | 错误恢复、上下文压缩、IterationBudget |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | — | TypeScript | Gateway 架构（参考价值有限） |
