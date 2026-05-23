# 迭代 041：Agent 引擎重构 — 删壳归位

> 优先级：P1 | 分类：优化 | 状态：✅ 已完成（2026-05-15）

## 背景

当前 `packages/agent/` 是一个过度抽象的空壳：
- **StateGraph**：3 节点线性管道，没有真正的分支/并行/循环
- **ToolRegistry**：hooks 机制被 AI SDK 直接调用绕过，从未触发
- **SubagentRegistry**：只是 `Map<string, config>`，无编排能力
- **AgentEventEmitter**：导出但从未实例化
- **PrismaCheckpointStore**：每步存但从不恢复，产生大量无用 DB 行

本质是在 AI SDK 已提供 tool calling + streaming 的情况下，额外套了一层 LangGraph-style 外壳。既有抽象的维护成本，又没有抽象的收益。

## 目标

1. 删除 `packages/agent/` 包
2. 将实际逻辑内联到 worker，形成扁平的 `runAgentLoop()` 函数
3. 自己控制 Agent Loop（maxSteps、maxRetries、退出条件、timeout）
4. 为后续六大支柱演进奠定基础

## 设计原则

- 先内联，等 Agent 写成熟了再抽象出独立包给其他项目复用
- 每个支柱按需渐进增长，不提前建空壳

## 六大支柱演进路线

### 1. Agent Loop（本次重点）

| 阶段 | 内容 |
|------|------|
| 本次 | `runAgentLoop()` — while loop 控制 step/retry/timeout/stop conditions |
| 下一步 | 可插拔的 stop strategy（token 用尽、tool 返回终止信号、用户中断） |
| 成熟后 | 提取为 `AgentLoop` class，支持 resume from checkpoint |

### 2. Context Engineering（保留现有，渐进增强）

| 阶段 | 内容 |
|------|------|
| 本次 | 保留 ContextManager，从 graph 依赖改为 loop 内直接调用 |
| 下一步 | loop 内加 token 计数，触发 compaction 阈值 |
| 成熟后 | Window + Summary + RAG 三层 context pipeline |

### 3. Tool System（去中间层）

| 阶段 | 内容 |
|------|------|
| 本次 | 直接用 AI SDK `tool()` 定义，删除 ToolRegistry/ToolDefinition |
| 下一步 | 如需 hooks，用 wrapper 函数包装单个 tool（不需要全局 Registry） |
| 成熟后 | Tool middleware chain（类似 Express middleware） |

### 4. Memory System（暂不动）

| 阶段 | 内容 |
|------|------|
| 本次 | 删除 CheckpointStore 死代码 |
| 下一步 | 按需设计 session memory（对话级别） |
| 成熟后 | Session memory + Long-term memory store |

### 5. Multi-Agent（保留现有模式）

| 阶段 | 内容 |
|------|------|
| 本次 | 保留 delegate-task 直接 streamText 调子 agent 的模式，删除 SubagentRegistry |
| 下一步 | 子 agent 配置改为普通对象/文件，按需 import |
| 成熟后 | Orchestrator pattern with message passing |

### 6. Harness Engineering（观测先行）

| 阶段 | 内容 |
|------|------|
| 本次 | 删除 AgentEventEmitter，用 structured console.log 替代 |
| 下一步 | 加 structured event logging（JSON 格式，方便 grep） |
| 成熟后 | OpenTelemetry traces + Guardrails + Eval pipeline |

## 实施步骤

### Phase 1：内联 Agent Loop

1. 在 `apps/worker/src/agent/` 创建 `run-agent-loop.ts`
   - while loop + maxSteps + maxRetries + timeout
   - streamText 调用 + fullStream 遍历 + Redis publish
   - 退出条件：无 tool call、达到 maxSteps、超时
2. 重写 `chat-turn.ts` processor，调用 `runAgentLoop()` 替代 `getTutorGraph().execute()`
3. 保留 `context-manager.ts`、`tools/`、`subagents/`、`services/` 目录不变

### Phase 2：删除 packages/agent

1. 删除 `packages/agent/` 目录
2. 从 `pnpm-workspace.yaml` 和各处 `package.json` 移除依赖
3. 更新 `apps/worker/` 内 import 路径
4. 删除 `apps/worker/src/graphs/` 目录

### Phase 3：清理残留

1. 删除 `createTutorTools()` deprecated 函数
2. Tool 定义从 `ToolDefinition` 格式改为直接 AI SDK `tool()` 格式
3. Subagent 配置从 class 改为普通 config 对象

## 目标文件结构

```
apps/worker/src/agent/
  run-agent-loop.ts       ← 核心：Agent Loop 控制
  context-manager.ts      ← 上下文工程（已有）
  provider.ts             ← LLM provider（已有）
  provider-registry.ts    ← provider 注册（已有）
  prompts/
    tutor.ts              ← system prompt 构建（已有）
  tools/
    index.ts              ← 导出所有 tool 定义
    assess-mastery.ts     ← 各 tool（已有，格式简化）
    ...
  subagents/
    index.ts              ← 子 agent 配置
    research.ts
    assessment.ts
  services/
    message-service.ts    ← 消息持久化（已有）
    node-service.ts       ← 节点操作（已有）
```

## 验收标准

- [x] `packages/agent/` 目录已删除
- [x] Worker 使用 `runAgentLoop()` 正常处理 chat-turn 任务
- [x] 自己控制 maxSteps / maxRetries / timeout
- [x] 所有现有 E2E 测试通过（全量回归）
- [x] 无性能退化（首 token 延迟不增加）

## 风险

- 重构幅度大（涉及 worker 核心流程），需要全量 E2E 回归
- `tutor-graph.ts` 内的流事件发布逻辑较长，内联时需保持一致

## E2E 影响

全量回归（核心 Agent 执行流程变更）
