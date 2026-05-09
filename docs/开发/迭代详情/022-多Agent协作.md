# 022 — 多 Agent 协作 + Subagent

> 状态：✅ 已完成 | 分类：🟠 优化 | 优先级：P2 | 依赖：018

**目标**：实现 Subagent Registry + 任务委派模式

**优先级**：P2 | **依赖**：018

#### 时序图

```mermaid
sequenceDetail
    participant Tutor as TutorAgent (主)
    participant Delegate as delegateTask Tool
    participant Registry as SubagentRegistry
    participant Sub as AssessmentAgent (子)
    participant LLM as GLM API
    participant Tool as assessMastery Tool

    Tutor->>LLM: 分析对话，决定委派评估任务
    LLM-->>Tutor: tool_call: delegateTask({agent: "assessment", task: "..."})

    Tutor->>Delegate: execute({agent: "assessment", task: "生成 3 道练习题"})
    Delegate->>Registry: get("assessment")
    Registry-->>Delegate: SubagentDefinition

    Delegate->>Sub: 启动子 Agent 执行
    Note over Sub: 子 Agent 使用独立 context<br/>tools: [assessMastery, generateQuiz]<br/>maxSteps: 3

    Sub->>LLM: streamText({model: glm-4-flash, ...})
    LLM-->>Sub: tool_call: generateQuiz
    Sub->>Tool: execute generateQuiz
    Tool-->>Sub: quiz data
    Sub->>LLM: 继续生成
    LLM-->>Sub: 最终结果（3 道题）

    Sub-->>Delegate: AgentResult {content, steps, toolCalls}
    Delegate->>Delegate: toModelOutput(result)
    Note over Delegate: 过滤详细过程，只返回摘要<br/>防止上下文污染

    Delegate-->>Tutor: "AssessmentAgent 完成：生成了 3 道关于 React Hooks 的练习题"
    Tutor->>LLM: 整合子 Agent 结果，继续对话
    LLM-->>Tutor: "我为你准备了 3 道练习题..."
```

#### 伪代码

```typescript
// apps/worker/src/agents/registry.ts — Subagent Registry
interface SubagentDefinition {
  name: string
  description: string
  systemPrompt: string
  tools: string[]              // ToolRegistry 中的工具名
  maxSteps: number
  model?: string               // 可指定更便宜的模型
  toModelOutput: (result: AgentResult) => string
}

export class SubagentRegistry {
  private agents = new Map<string, SubagentDefinition>()

  register(def: SubagentDefinition): void { this.agents.set(def.name, def) }
  get(name: string): SubagentDefinition | undefined { return this.agents.get(name) }

  getAgentDescriptions(): string {
    return Array.from(this.agents.values())
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n")
  }
}

// 注册子 Agent
registry.register({
  name: "assessment",
  description: "生成练习题、评估学生答案、出具阶段性学习报告",
  systemPrompt: "你是一个专门出题和评估的 Agent...",
  tools: ["assessMastery", "generateQuiz"],
  maxSteps: 3,
  model: "glm-4-flash",
  toModelOutput: (result) => {
    // 只返回摘要，不返回子 Agent 的详细对话过程
    return `AssessmentAgent 完成：${result.content.slice(0, 200)}`
  },
})

registry.register({
  name: "research",
  description: "检索知识库，搜索教学资料，提供 RAG 增强的参考资料",
  systemPrompt: "你是一个只读研究 Agent，负责搜索和整理资料...",
  tools: ["searchKnowledge", "getContext"],
  maxSteps: 5,
  model: "glm-4-flash",
  toModelOutput: (result) => `ResearchAgent 找到以下资料：${result.content.slice(0, 500)}`,
})

// apps/worker/src/tools/delegate-task.ts — 委派工具
export const delegateTaskTool: ToolDefinition = {
  name: "delegateTask",
  description: "将任务委派给专业子 Agent 执行。可选子 Agent：assessment（出题评估）、research（资料检索）",
  parameters: z.object({
    agent: z.string().describe("子 Agent 名称"),
    task: z.string().describe("任务描述"),
  }),
  execute: async (params, ctx: ToolExecutionContext): Promise<ToolResult> => {
    const agentDef = ctx.subagentRegistry.get(params.agent)
    if (!agentDef) return { success: false, error: `Unknown agent: ${params.agent}` }

    // 筛选子 Agent 可用的工具
    const subTools = agentDef.tools.reduce((acc, name) => {
      const tool = ctx.toolRegistry.getTool(name)
      if (tool) acc[name] = tool
      return acc
    }, {})

    // 执行子 Agent
    const result = await streamText({
      model: getModel(agentDef.model ?? "glm-4-flash"),
      system: agentDef.systemPrompt,
      prompt: params.task,
      tools: subTools,
      maxSteps: agentDef.maxSteps,
    })

    const fullResult = await result.text
    const summary = agentDef.toModelOutput({ content: fullResult, steps: 0, toolCalls: [] })

    return {
      success: true,
      content: summary,
      // 不暴露子 Agent 的原始输出给主 Agent，防止上下文污染
    }
  },
  promptSnippet: `你可以通过 delegateTask 工具委派任务给专业子 Agent：
${registry.getAgentDescriptions()}

委派后你会收到子 Agent 的执行摘要，不会看到完整过程。`,
}
```

#### 文件清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `apps/worker/src/agents/registry.ts` | SubagentRegistry 实现 |
| 新增 | `apps/worker/src/agents/assessment.ts` | AssessmentAgent 定义 + system prompt |
| 新增 | `apps/worker/src/agents/research.ts` | ResearchAgent 定义 + system prompt |
| 新增 | `apps/worker/src/tools/delegate-task.ts` | delegateTask 工具实现 |
| 修改 | `apps/worker/src/tools/search-knowledge.ts` | 新增 ResearchAgent 用的搜索工具 |
| 修改 | `apps/worker/src/tools/generate-quiz.ts` | 新增 AssessmentAgent 用的出题工具 |
| 修改 | `apps/worker/src/graphs/tutor-graph.ts` | agent_loop 节点注册 delegateTask |
| 修改 | `apps/worker/src/engine/agent-loop.ts` | 接入 SubagentRegistry |
| 修改 | `packages/agent/src/types.ts` | 新增 SubagentDefinition, AgentResult 类型 |

#### Checklist

- [x] 定义 SubagentDefinition 接口（name, description, agent, tools）
- [x] 实现 SUBAGENT_REGISTRY（AssessmentAgent, ResearchAgent）
- [x] ResearchAgent: 只读工具（search, read），5 步限制
- [x] AssessmentAgent: 生成练习题 + 评估答案，3 步限制
- [x] 实现 `delegateTask` 工具（async generator streaming + toModelOutput）
- [x] TutorAgent 可通过 delegateTask 委派任务给子 Agent
- [x] 子 Agent 使用更便宜的模型（glm-4-flash）
- [x] 实现 `toModelOutput` 控制返回给主 Agent 的内容（防止上下文污染）
- [x] 文档更新：技术架构.md（多 Agent 章节）、Prompt设计.md

#### 验证标准

| 验证项 | 通过条件 |
|--------|---------|
| 子 Agent 注册 | SubagentRegistry 可查询 assessment / research 两个 Agent |
| 任务委派 | TutorAgent 在对话中调用 delegateTask 委派任务 |
| AssessmentAgent | 生成 3 道练习题并返回结构化数据 |
| ResearchAgent | 搜索知识库并返回相关资料摘要 |
| toModelOutput | 子 Agent 详细过程被过滤，主 Agent 只看到摘要 |
| 上下文隔离 | 子 Agent 对话不污染主 Agent 的上下文窗口 |
| 步数限制 | AssessmentAgent 最多 3 步，ResearchAgent 最多 5 步 |
| 模型选择 | 子 Agent 使用 glm-4-flash（非主模型） |
| E2E 全量 | `npx playwright test` 全部通过 |

## E2E 覆盖

| E2E 分类 | 测试文件 | 关键用例 ID | 备注 |
|---------|---------|------------|------|
| Sub-Agent 委派 | `e2e/chat.spec.ts` | 新增用例 | delegateTask 调用链路 |
| 上下文隔离 | `e2e/chat.spec.ts` | 新增用例 | 子 Agent 不污染主对话 |

### 需要新增的测试

| 测试场景 | 优先级 | 说明 |
|---------|--------|------|
| Sub-Agent 委派 — AssessmentAgent | P0 | TutorAgent 调用 delegateTask 委派出题任务，返回练习题 |
| Sub-Agent 委派 — ResearchAgent | P1 | TutorAgent 调用 delegateTask 委派资料检索，返回摘要 |
| 任务完成 — 结构化返回 | P0 | 子 Agent 结果经过 toModelOutput 过滤，只显示摘要 |
| 上下文隔离 | P1 | 子 Agent 的详细对话不出现在主对话历史中 |
| 步数限制 | P2 | AssessmentAgent 超过 3 步自动终止 |
