# Agent Loop 健壮性迭代 Implementation Plan（#2 failover + #4 循环检测 + #3 模型切换）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 agent loop 加 failover 分层降级、循环检测（注入提示+熔断）、模型回答中切换的 abort 通道，并统一 SSE 事件协议。

**Architecture:** ① 先统一 SSE 事件协议到 `packages/shared`（消除散写）；② 建 control channel abort signal 链贯穿 chat-turn→runAgentLoop→streamText；③ LlmConfig 加 fallback 字段，单步 streamText 包 `runStepWithFailover` 降级（流式→非流式→fallbackModel→fallbackConfig），降级轨迹可见；④ 新建 `loop-detector.ts` 纯函数做哈希指纹+ping-pong+熔断，注入提示给 1-2 次纠正机会；⑤ 前端回答中禁用模型切换 + stop 调 abort API。

**Tech Stack:** Hono + BullMQ + ioredis + ai SDK（streamText/generateText）+ Prisma + Vitest + Playwright

**Spec:** `docs/superpowers/specs/2026-06-30-agent-loop体验与健壮性-design.md` 第 2 组

**依赖：** 第 1 组 Bug 修复应已完成（不强制，但建议先合并）

---

## File Structure

| 文件                                              | 职责                                                                              | 改动       |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| `packages/shared/src/schemas/sse-event.ts`        | 新建 — SSE 事件统一 schema + 枚举 + 工厂/解析函数                                 | Task 1     |
| `packages/shared/src/index.ts`                    | 导出 sse-event                                                                    | Task 1     |
| `apps/worker/src/agent/run-agent-loop.ts`         | 主循环 — abort 检查 + failover 单步包装 + 循环检测 + step/reasoning/failover 事件 | Task 3,4,5 |
| `apps/worker/src/agent/run-step-with-failover.ts` | 新建 — 单步降级链                                                                 | Task 4     |
| `apps/worker/src/agent/loop-detector.ts`          | 新建 — 循环检测纯函数                                                             | Task 5     |
| `apps/worker/src/processors/chat-turn.ts`         | getProviderForJob 扩展 fallback 链 + control channel 订阅 + abort signal 传入     | Task 2,4   |
| `apps/server/src/routes/chat.ts`                  | onAbort 发 control 信号 + 新增 abort 路由                                         | Task 2     |
| `packages/db/prisma/schema.prisma` + 新迁移       | LlmConfig 加 fallbackModelId/fallbackLlmConfigId                                  | Task 6     |
| `packages/shared/src/schemas/llm-config.ts`       | zod schema 加 fallback 字段                                                       | Task 6     |
| `packages/shared/src/services/provider-select.ts` | resolveFallbackProvider                                                           | Task 6     |
| `apps/web/src/components/chat/chat-input.tsx`     | 回答中禁用模型切换                                                                | Task 7     |
| `apps/web/src/hooks/use-chat-stream.ts`           | stop 调 abort API                                                                 | Task 7     |

---

## Task 1: SSE 事件协议统一（前置基础设施）

当前事件 type 散写，前端两套重复 if 链。先统一协议，后续 task 都用它。

**Files:**

- Create: `packages/shared/src/schemas/sse-event.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: 新建 sse-event.ts — 事件枚举 + 工厂/解析函数**

创建 `packages/shared/src/schemas/sse-event.ts`：

```ts
import { z } from "zod";

// SSE 事件类型枚举（含现有 + 本迭代新增）
export const SSEEventType = {
  TextDelta: "text-delta",
  ToolCall: "tool-call",
  ToolResult: "tool-result",
  UiStreamStart: "ui-stream-start",
  UiBlockDelta: "ui-block-delta",
  UiBlocks: "ui-blocks",
  CodePush: "code-push",
  AskQuestion: "ask-question",
  RoadmapUpdated: "roadmap-updated",
  SessionUpdated: "session-updated",
  TitleUpdated: "title-updated",
  Error: "error",
  Done: "done",
  // 本迭代新增
  StepStart: "step-start",
  StepEnd: "step-end",
  ReasoningDelta: "reasoning-delta",
  Failover: "failover",
  LoopWarning: "loop-warning",
  Usage: "usage",
  ContextInfo: "context-info",
  Abort: "abort",
} as const;

export type SSEEventType = (typeof SSEEventType)[keyof typeof SSEEventType];

// 宽松的通用事件 schema（data 为 unknown，由消费方按 type 细化）
export const SSEEventSchema = z.object({
  type: z.string(),
  content: z.unknown().optional(),
  data: z.unknown().optional(),
  message: z.string().optional(),
});

export type SSEEvent = z.infer<typeof SSEEventSchema>;

/** worker 端构造事件 */
export function createSSEEvent(
  type: SSEEventType,
  payload?: Record<string, unknown>,
): string {
  return JSON.stringify({ type, ...payload });
}

/** 前端解析事件（已 JSON.parse 后的对象） */
export function parseSSEEvent(raw: unknown): SSEEvent | null {
  const result = SSEEventSchema.safeParse(raw);
  return result.success ? result.data : null;
}
```

> 说明：用宽松 schema（data 为 unknown）而非逐类型 discriminatedUnion，因为现有事件 data 结构多样且前端按 type 分支处理。统一工厂/解析消除散写 `JSON.stringify({type:...})` 和重复 if 链。

- [ ] **Step 2: 导出**

在 `packages/shared/src/index.ts` 加：

```ts
export * from "./schemas/sse-event";
```

- [ ] **Step 3: worker 端用工厂函数替换散写**

在 `apps/worker/src/agent/run-agent-loop.ts` 顶部 import：

```ts
import { createSSEEvent, SSEEventType } from "@ai-teacher/shared";
```

把所有 `JSON.stringify({ type: "text-delta", ... })` 替换为 `createSSEEvent(SSEEventType.TextDelta, { content: text })`，其余事件同理（tool-call/tool-result/ui-\* 等）。逐处替换，保持 payload 字段不变。

> 这是机械替换，逐个 event 对照 SSEEventType 常量映射。`chat-turn.ts` 的 `title-updated`/`done`/`error` 也同样替换。

- [ ] **Step 4: 前端用 parseSSEEvent 替换 if 链**

在 `apps/web/src/hooks/use-chat-stream.ts` 顶部 import `parseSSEEvent, SSEEventType`。把 `:188-338`（主链）和 `:447-564`（resume 链）的 `if (event.type === "...")` 提取为一个共享 handler 函数 `handleSSEEvent(event, ctx)`，两链都调用它，消除重复。

> 注意：此步只做结构重构，不改变任何行为。先确保重构后行为与原来一致。

- [ ] **Step 5: 测试 + typecheck**

Run: `pnpm --filter @ai-teacher/shared test && pnpm -r typecheck`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/schemas/sse-event.ts packages/shared/src/index.ts apps/worker/src/agent/run-agent-loop.ts apps/worker/src/processors/chat-turn.ts apps/web/src/hooks/use-chat-stream.ts
git commit -m "refactor(sse): 统一 SSE 事件协议到 shared（枚举+工厂+解析，消除散写）"
```

---

## Task 2: Abort Signal 链 — control channel + abort 路由（#3 基础设施）

建立 server onAbort → control channel → worker 检查 flag → runAgentLoop 中断的能力。

**Files:**

- Modify: `apps/server/src/routes/chat.ts:26-91`
- Modify: `apps/worker/src/processors/chat-turn.ts:146-160`
- Modify: `apps/worker/src/agent/run-agent-loop.ts:10-19,50-62`

- [ ] **Step 1: server onAbort 发 control 信号**

在 `apps/server/src/routes/chat.ts` 的 `subscribeAndStream`（`:26`）内，`stream.onAbort`（`:43-48`）里增加往 control channel 发 abort。需要建一个 publisher。在函数顶部 `const subscriber = new Redis(...)`（`:28`）旁加：

```ts
const controlPublisher = new Redis(REDIS_URL);
```

把 `stream.onAbort`（`:43-48`）改为：

```ts
stream.onAbort(() => {
  closed = true;
  subscriber.off("message", onMessage);
  subscriber.disconnect();
  // 通知 worker 终止进行中的 job
  controlPublisher
    .publish(`chat:${sessionId}:control`, JSON.stringify({ type: "abort" }))
    .catch(() => {});
  controlPublisher.quit();
  wake?.();
});
```

- [ ] **Step 2: 新增 POST /abort 路由**

在 `apps/server/src/routes/chat.ts` 的 `chatRoute`（`:93`）链上，加一个 abort 路由（用于前端 stop 主动调用，即使用户没断 SSE）：

```ts
  .post("/:sessionId/abort", async (c) => {
    const sessionId = c.req.param("sessionId");
    const publisher = new Redis(REDIS_URL);
    await publisher.publish(`chat:${sessionId}:control`, JSON.stringify({ type: "abort" }));
    publisher.quit();
    return c.json({ ok: true });
  });
```

> 注意路由挂载路径：chatRoute 挂载于 `/api/sessions/:sessionId/chat` 还是 `/api/chat`？读取 `apps/server/src/index.ts` 确认挂载点。若 chatRoute 是 `/api/chat`，则 abort 路由是 `POST /api/chat/:sessionId/abort`；若需 `/api/sessions/:sessionId/abort`，则挂到 sessions 路由。以 index.ts 实际挂载为准调整。

- [ ] **Step 3: worker 订阅 control channel + 建 AbortController**

在 `apps/worker/src/processors/chat-turn.ts` 的 processor（`:153` 起）内，`const channel = ...`（`:155`）后加：

```ts
// Abort 通道：订阅 control channel，收到 abort 则触发 AbortController
const abortController = new AbortController();
const controlSubscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const controlChannel = `chat:${sessionId}:control`;
controlSubscriber.on("message", (_ch, payload) => {
  try {
    const msg = JSON.parse(payload);
    if (msg.type === "abort") {
      console.log(`[chat-turn] abort signal for session ${sessionId}`);
      abortController.abort();
    }
  } catch {
    /* ignore */
  }
});
await controlSubscriber.subscribe(controlChannel);
```

在 processor 的 finally/结尾（搜索 job 结束清理处，或 catch 块后）加清理：

```ts
controlSubscriber.unsubscribe(controlChannel);
controlSubscriber.quit();
```

> 注意：确保 try/catch/finally 结构里 controlSubscriber 都能被清理。读取 `:460-484` 的 worker 结尾结构确认。

- [ ] **Step 4: runAgentLoop 接受并检查 abortSignal**

在 `apps/worker/src/agent/run-agent-loop.ts`：

`AgentLoopOptions`（`:10-19`）加字段：

```ts
  abortSignal?: AbortSignal;
```

`AgentLoopResult.stopReason`（`:25`）类型加 `"aborted"`：

```ts
stopReason: "no-tool-call" | "max-steps" | "timeout" | "aborted";
```

循环顶部（`:51` deadline 检查旁）加 abort 检查：

```ts
  for (step = 0; step < maxSteps; step++) {
    if (opts.abortSignal?.aborted) {
      stopReason = "aborted";
      break;
    }
    if (Date.now() > deadline) {
      stopReason = "timeout";
      break;
    }
```

`streamText`（`:56`）传 abortSignal：

```ts
const result = streamText({
  model,
  system,
  messages: currentMessages,
  tools,
  stopWhen: stepCountIs(1),
  abortSignal: opts.abortSignal,
});
```

内层 fullStream 循环（`:70`）顶部也加检查：

```ts
    for await (const event of result.fullStream) {
      if (opts.abortSignal?.aborted) {
        stopReason = "aborted";
        break;
      }
      if (Date.now() > deadline) {
```

- [ ] **Step 5: chat-turn 调用处传入 abortSignal**

`apps/worker/src/processors/chat-turn.ts:377` 的 `runAgentLoop({...})` 调用加：

```ts
const loopResult = await runAgentLoop({
  model,
  system: finalSystemPrompt,
  messages: prepared.messages,
  tools,
  publisher,
  channel,
  maxSteps: 7,
  timeoutMs: STREAM_TIMEOUT_MS,
  abortSignal: abortController.signal,
});
```

并在 loopResult 返回后，若 `stopReason === "aborted"`，publish done with reason：

```ts
if (loopResult.stopReason === "aborted") {
  await publisher.publish(
    channel,
    createSSEEvent(SSEEventType.Done, { reason: "aborted" }),
  );
}
```

- [ ] **Step 6: 前端 stop 调 abort API**

`apps/web/src/hooks/use-chat-stream.ts:361-364` 的 `stop` 改为：

```ts
const stop = useCallback(async () => {
  abortControllerRef.current?.abort();
  setIsLoading(false);
  try {
    await fetch(`/api/chat/${sessionId}/abort`, { method: "POST" });
  } catch {
    /* ignore */
  }
}, [sessionId]);
```

> 路径以 Step 2 实际挂载点为准。

- [ ] **Step 7: typecheck + 单测**

Run: `pnpm -r typecheck && pnpm test:unit`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add apps/server/src/routes/chat.ts apps/worker/src/processors/chat-turn.ts apps/worker/src/agent/run-agent-loop.ts apps/web/src/hooks/use-chat-stream.ts
git commit -m "feat(loop): abort signal 链 — control channel + abort 路由，stop 真正终止 worker"
```

---

## Task 3: 循环检测 — loop-detector 纯函数（#4，TDD）

先做纯函数循环检测逻辑，易测试。

**Files:**

- Create: `apps/worker/src/agent/loop-detector.ts`
- Test: `apps/worker/src/agent/loop-detector.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/worker/src/agent/loop-detector.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { LoopDetector, type LoopDetection } from "./loop-detector";

describe("LoopDetector", () => {
  it("无重复 → 无检测", () => {
    const d = new LoopDetector();
    expect(
      d.check({ toolName: "retrieve-context", args: { query: "a" } }),
    ).toBeNull();
    expect(
      d.check({ toolName: "retrieve-context", args: { query: "b" } }),
    ).toBeNull();
  });

  it("相同指纹连续 ≥2 → hash-loop", () => {
    const d = new LoopDetector();
    d.check({ toolName: "renderUI", args: { x: 1 } });
    const r = d.check({ toolName: "renderUI", args: { x: 1 } });
    expect(r?.type).toBe("hash-loop");
    expect(r?.toolName).toBe("renderUI");
  });

  it("A→B→A→B → ping-pong", () => {
    const d = new LoopDetector();
    d.check({ toolName: "a", args: {} });
    d.check({ toolName: "b", args: {} });
    d.check({ toolName: "a", args: {} });
    const r = d.check({ toolName: "b", args: {} });
    expect(r?.type).toBe("ping-pong");
  });

  it("retrieve-context 白名单放宽：连续 2 次相同不报 hash-loop", () => {
    const d = new LoopDetector();
    d.check({ toolName: "retrieve-context", args: { query: "a" } });
    const r = d.check({ toolName: "retrieve-context", args: { query: "a" } });
    expect(r).toBeNull();
  });

  it("retrieve-context 连续 5 次相同 → 仍熔断", () => {
    const d = new LoopDetector();
    for (let i = 0; i < 4; i++)
      d.check({ toolName: "retrieve-context", args: { query: "a" } });
    const r = d.check({ toolName: "retrieve-context", args: { query: "a" } });
    expect(r?.type).toBe("hash-loop");
  });

  it("纠正次数累计 ≥3 → circuit-break", () => {
    const d = new LoopDetector();
    for (let cycle = 0; cycle < 3; cycle++) {
      d.check({ toolName: "renderUI", args: { x: cycle } });
      const r = d.check({ toolName: "renderUI", args: { x: cycle } });
      d.recordCorrection();
      if (cycle < 2) expect(r?.type).toBe("hash-loop");
    }
    // 第 3 次纠正后应熔断
    const r = d.shouldCircuitBreak();
    expect(r).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @ai-teacher/worker test -- loop-detector.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 loop-detector.ts**

创建 `apps/worker/src/agent/loop-detector.ts`：

```ts
// 循环检测：哈希指纹 + ping-pong + 全局熔断
// 只读工具（retrieve-context 等）放宽阈值，避免误杀合法分页/重试

export interface LoopDetection {
  type: "hash-loop" | "ping-pong" | "circuit-break";
  toolName: string;
}

interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

// 可重复调用的只读工具白名单（放宽到连续 5 次才报）
const READONLY_WHITELIST = new Set(["retrieve-context", "search"]);

function fingerprint(call: ToolCall): string {
  // 归一化：排序 args key，忽略分页 offset/limit
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(call.args).sort()) {
    if (k === "offset" || k === "limit" || k === "page") continue;
    normalized[k] = call.args[k];
  }
  return `${call.toolName}:${JSON.stringify(normalized)}`;
}

export class LoopDetector {
  private recent: string[] = []; // 最近 4 步指纹
  private corrections = 0;

  check(call: ToolCall): LoopDetection | null {
    const fp = fingerprint(call);
    this.recent.push(fp);
    if (this.recent.length > 4) this.recent.shift();

    // hash-loop：相同指纹连续出现
    const isReadonly = READONLY_WHITELIST.has(call.toolName);
    const threshold = isReadonly ? 5 : 2;
    const consecutive = this.countConsecutive(fp);
    if (consecutive >= threshold) {
      return { type: "hash-loop", toolName: call.toolName };
    }

    // ping-pong：X-Y-X-Y（仅对非白名单工具）
    if (!isReadonly && this.recent.length === 4) {
      const [a, b, c, d] = this.recent;
      if (a === c && b === d && a !== b) {
        return { type: "ping-pong", toolName: call.toolName };
      }
    }
    return null;
  }

  private countConsecutive(fp: string): number {
    let n = 0;
    for (let i = this.recent.length - 1; i >= 0; i--) {
      if (this.recent[i] === fp) n++;
      else break;
    }
    return n;
  }

  recordCorrection(): void {
    this.corrections++;
  }

  shouldCircuitBreak(): boolean {
    return this.corrections >= 3;
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @ai-teacher/worker test -- loop-detector.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/worker/src/agent/loop-detector.ts apps/worker/src/agent/loop-detector.test.ts
git commit -m "feat(loop): 循环检测纯函数 — 哈希指纹+ping-pong+熔断+只读白名单"
```

---

## Task 4: 循环检测集成到 runAgentLoop + Failover 单步降级（#4 + #2）

把 loop-detector 接入循环，把单步 streamText 包成 runStepWithFailover。

**Files:**

- Modify: `apps/worker/src/agent/run-agent-loop.ts`
- Create: `apps/worker/src/agent/run-step-with-failover.ts`
- Modify: `apps/worker/src/processors/chat-turn.ts:60-93`
- Modify: `packages/db/prisma/schema.prisma` + 新迁移
- Modify: `packages/shared/src/schemas/llm-config.ts`
- Modify: `packages/shared/src/services/provider-select.ts`

- [ ] **Step 1: LlmConfig 加 fallback 字段（schema + 迁移）**

读取 `packages/db/prisma/schema.prisma` 的 LlmConfig model（约 `:237-253`）。在 `source` 字段后、`createdAt` 前加：

```prisma
  fallbackModelId      String?  @db.Text
  fallbackLlmConfigId  String?  @db.Text
  fallbackConfig       LlmConfig? @relation("LlmConfigFallback", fields: [fallbackLlmConfigId], references: [id])
  fallbackFor          LlmConfig[] @relation("LlmConfigFallback")
```

生成迁移：

Run: `cd packages/db && pnpm exec prisma migrate dev --name add_llm_config_fallback`
Expected: 生成 `prisma/migrations/<timestamp>_add_llm_config_fallback/migration.sql`，含 ALTER TABLE 加两列 + 自引用外键。

Run: `pnpm db:generate`
Expected: client 重新生成含新字段

- [ ] **Step 2: zod schema + RawLlmConfig 加 fallback 字段**

`packages/shared/src/schemas/llm-config.ts` 的 `CreateLlmConfigSchema`（`:10`）加：

```ts
  fallbackModelId: z.string().optional(),
  fallbackLlmConfigId: z.string().optional(),
```

`LlmConfigResponse`（`:20`）加：

```ts
fallbackModelId: string | null;
fallbackLlmConfigId: string | null;
```

`packages/shared/src/services/provider-select.ts` 的 `RawLlmConfig`（`:3-10`）加：

```ts
fallbackModelId: string | null;
fallbackLlmConfigId: string | null;
```

`resolveProviderConfig` 的两个 `select`（`:35, :43`）加 `fallbackModelId: true, fallbackLlmConfigId: true`。

- [ ] **Step 3: resolveFallbackProvider**

在 `packages/shared/src/services/provider-select.ts` 加导出函数：

```ts
/** 解析 fallback 配置链：返回 [fallbackModel（同config换模型）, fallbackConfig（跨config）] */
export async function resolveFallbackConfigs(
  prisma: PrismaClient,
  config: RawLlmConfig,
): Promise<{
  fallbackModelId: string | null;
  fallbackConfig: RawLlmConfig | null;
}> {
  let fallbackConfig: RawLlmConfig | null = null;
  if (config.fallbackLlmConfigId) {
    const fc = await prisma.llmConfig.findFirst({
      where: { id: config.fallbackLlmConfigId },
      select: {
        id: true,
        provider: true,
        encryptedKey: true,
        baseUrl: true,
        defaultModel: true,
        isDefault: true,
        fallbackModelId: true,
        fallbackLlmConfigId: true,
      },
    });
    if (fc) fallbackConfig = fc;
  }
  return { fallbackModelId: config.fallbackModelId, fallbackConfig };
}
```

- [ ] **Step 4: getProviderForJob 扩展返回 fallback 链**

`apps/worker/src/processors/chat-turn.ts:60-93` 的 `LlmJobConfig` 接口加 fallback 字段：

```ts
interface LlmJobConfig {
  providerFn: (
    modelId: string,
  ) => ReturnType<ReturnType<typeof createProviderForConfig>>;
  sandboxModel?: string;
  sandboxBaseUrl?: string;
  fallbackModelId?: string; // 同 config 换低级模型
  fallbackProviderFn?: (
    modelId: string,
  ) => ReturnType<ReturnType<typeof createProviderForConfig>>;
  fallbackModel?: string;
}
```

`getProviderForJob` 在 `resolved.config` 分支（`:79-90`）内，解析 fallback：

```ts
if (resolved.config) {
  const apiKey = decrypt(resolved.config.encryptedKey);
  const providerFn = createProviderForConfig({
    provider: resolved.config.provider,
    apiKey,
    baseUrl: resolved.config.baseUrl ?? undefined,
  });
  const { fallbackModelId, fallbackConfig } = await resolveFallbackConfigs(
    prisma,
    resolved.config,
  );
  const job: LlmJobConfig = {
    providerFn,
    sandboxModel: resolved.config.defaultModel,
    sandboxBaseUrl: resolved.config.baseUrl ?? undefined,
    fallbackModelId: fallbackModelId ?? undefined,
  };
  if (fallbackConfig) {
    const fbApiKey = decrypt(fallbackConfig.encryptedKey);
    job.fallbackProviderFn = createProviderForConfig({
      provider: fallbackConfig.provider,
      apiKey: fbApiKey,
      baseUrl: fallbackConfig.baseUrl ?? undefined,
    });
    job.fallbackModel = fallbackConfig.defaultModel;
  }
  return job;
}
```

顶部 import 加 `resolveFallbackConfigs`。

- [ ] **Step 5: 新建 run-step-with-failover.ts — 单步降级链**

创建 `apps/worker/src/agent/run-step-with-failover.ts`：

```ts
import {
  streamText,
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type Tool,
} from "ai";
import { createSSEEvent, SSEEventType } from "@ai-teacher/shared";

export interface StepFailoverOptions {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools: Record<string, Tool>;
  publisher: { publish: (channel: string, message: string) => Promise<number> };
  channel: string;
  step: number;
  abortSignal?: AbortSignal;
  // fallback 降级
  fallbackModel?: LanguageModel; // 同 config 换模型
  fallbackProviderModel?: { model: LanguageModel }; // 跨 config
}

export interface StepFailoverResult {
  fullStream: AsyncIterable<unknown>;
  response: Promise<{ messages: ModelMessage[] }>;
  usage: Promise<unknown>;
  degradedTo?: "non-stream" | "fallback-model" | "fallback-config";
}

/**
 * 单步推理带分层降级：
 * ① 流式 streamText（主 model）
 * ② 非流式 generateText（主 model）— 模拟 text-delta 一次性下发
 * ③ 流式 streamText（fallbackModel 同 config）
 * ④ 流式 streamText（fallbackProviderModel 跨 config）
 */
export async function runStepWithFailover(
  opts: StepFailoverOptions,
): Promise<StepFailoverResult> {
  const base = {
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    stopWhen: stepCountIs(1),
    abortSignal: opts.abortSignal,
  };

  // ① 流式
  try {
    const result = streamText({ model: opts.model, ...base });
    return {
      fullStream: result.fullStream,
      response: result.response.then((r) => ({ messages: r.messages })),
      usage: result.totalUsage,
    };
  } catch (err) {
    await publishFailover(opts, "stream", "non-stream", err);
  }

  // ② 非流式
  try {
    const { text, response, usage } = await generateText({
      model: opts.model,
      ...base,
    });
    // 模拟 text-delta 一次性下发
    await opts.publisher.publish(
      opts.channel,
      createSSEEvent(SSEEventType.TextDelta, { content: text }),
    );
    return {
      fullStream: emptyAsyncIter(),
      response: Promise.resolve({ messages: response.messages }),
      usage: Promise.resolve(usage),
      degradedTo: "non-stream",
    };
  } catch (err) {
    await publishFailover(
      opts,
      "non-stream",
      opts.fallbackModel ? "fallback-model" : "fallback-config",
      err,
    );
  }

  // ③ fallbackModel（同 config）
  if (opts.fallbackModel) {
    try {
      const result = streamText({ model: opts.fallbackModel, ...base });
      return {
        fullStream: result.fullStream,
        response: result.response.then((r) => ({ messages: r.messages })),
        usage: result.totalUsage,
        degradedTo: "fallback-model",
      };
    } catch (err) {
      await publishFailover(opts, "fallback-model", "fallback-config", err);
    }
  }

  // ④ fallbackProviderModel（跨 config）
  if (opts.fallbackProviderModel) {
    const result = streamText({
      model: opts.fallbackProviderModel.model,
      ...base,
    });
    return {
      fullStream: result.fullStream,
      response: result.response.then((r) => ({ messages: r.messages })),
      usage: result.totalUsage,
      degradedTo: "fallback-config",
    };
  }

  throw new Error("所有降级链耗尽，无可用模型");
}

async function publishFailover(
  opts: StepFailoverOptions,
  from: string,
  to: string,
  err: unknown,
) {
  await opts.publisher.publish(
    opts.channel,
    createSSEEvent(SSEEventType.Failover, {
      from,
      to,
      reason: err instanceof Error ? err.message : String(err),
      step: opts.step,
    }),
  );
}

async function* emptyAsyncIter(): AsyncIterable<unknown> {
  /* no events */
}
```

> 注意：streamText 的错误通常在消费 fullStream 时抛出（而非调用时）。完整的 failover 需要把 fullStream 消费也包进 try/catch。本 Step 先建立骨架；Step 6 集成时，runAgentLoop 内 fullStream 消费的 catch 会触发降级重试（即把降级逻辑放在 fullStream 错误捕获处）。若 streamText 调用即抛（如 provider 构造错误），上面的 try/catch 生效。

- [ ] **Step 6: runAgentLoop 集成 failover + 循环检测**

`apps/worker/src/agent/run-agent-loop.ts` 顶部 import：

```ts
import { LoopDetector } from "./loop-detector";
import { runStepWithFailover } from "./run-step-with-failover";
```

`AgentLoopOptions` 加 fallback 字段：

```ts
  fallbackModel?: LanguageModel;
  fallbackProviderModel?: { model: LanguageModel };
```

在循环开始前建 detector：

```ts
const loopDetector = new LoopDetector();
```

把 `:56` 的 `const result = streamText({...})` 替换为 `runStepWithFailover`：

```ts
const stepResult = await runStepWithFailover({
  model,
  system,
  messages: currentMessages,
  tools,
  publisher,
  channel,
  step,
  abortSignal: opts.abortSignal,
  fallbackModel: opts.fallbackModel,
  fallbackProviderModel: opts.fallbackProviderModel,
});
const result = {
  fullStream: stepResult.fullStream,
  response: stepResult.response,
  totalUsage: stepResult.usage,
};
```

在 tool-call 事件处理处（`:115`），记录到 detector 并检测循环：

```ts
      } else if (eventType === "tool-call" && "toolName" in event) {
        stepHasToolCall = true;
        const tcEvent = event as { toolName: string; input: unknown };
        // 循环检测
        const detection = loopDetector.check({ toolName: tcEvent.toolName, args: (tcEvent.input as Record<string, unknown>) ?? {} });
        if (detection) {
          if (loopDetector.shouldCircuitBreak() || detection.type === "circuit-break") {
            await publisher.publish(channel, createSSEEvent(SSEEventType.Error, { message: `检测到循环调用（${detection.toolName}），已停止。请换个方式提问。` }));
            stopReason = "aborted";
            break;
          }
          // 注入提示让模型纠正
          loopDetector.recordCorrection();
          await publisher.publish(channel, createSSEEvent(SSEEventType.LoopWarning, { type: detection.type, toolName: detection.toolName, step }));
          currentMessages.push({ role: "system", content: `你连续重复调用了 ${detection.toolName}，请换思路或直接用已有信息回答。` });
        }
        await publisher.publish(channel, createSSEEvent(SSEEventType.ToolCall, { data: { toolName: tcEvent.toolName, input: tcEvent.input } }));
      }
```

> 注意：注入 system 消息到 currentMessages 会在下一步 streamText 生效。需确保 currentMessages 是可变的（当前是 `[...messages]`，可 push）。

- [ ] **Step 7: chat-turn 传入 fallback model**

`apps/worker/src/processors/chat-turn.ts:377` 的 runAgentLoop 调用，在 model 后加 fallback：

```ts
const loopResult = await runAgentLoop({
  model,
  system: finalSystemPrompt,
  messages: prepared.messages,
  tools,
  publisher,
  channel,
  maxSteps: 7,
  timeoutMs: STREAM_TIMEOUT_MS,
  abortSignal: abortController.signal,
  fallbackModel: llmJobConfig.fallbackModelId
    ? providerFn(llmJobConfig.fallbackModelId)
    : undefined,
  fallbackProviderModel: llmJobConfig.fallbackProviderFn
    ? {
        model: llmJobConfig.fallbackProviderFn(
          llmJobConfig.fallbackModel ?? "deepseek-v4-flash",
        ),
      }
    : undefined,
});
```

- [ ] **Step 8: typecheck + 单测**

Run: `pnpm -r typecheck && pnpm test:unit`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations packages/shared/src/schemas/llm-config.ts packages/shared/src/services/provider-select.ts apps/worker/src/processors/chat-turn.ts apps/worker/src/agent/run-step-with-failover.ts apps/worker/src/agent/run-agent-loop.ts
git commit -m "feat(loop): failover 分层降级 + 循环检测注入提示+熔断集成到 runAgentLoop"
```

---

## Task 5: 前端回答中禁用模型切换（#3）

**Files:**

- Modify: `apps/web/src/components/chat/chat-input.tsx:111-149`
- Modify: `apps/web/src/components/settings/llm-config-form.tsx`

- [ ] **Step 1: chat-input 模型下拉 isLoading 时 disabled**

读取 `apps/web/src/components/chat/chat-input.tsx:111-149` 的模型下拉。给触发按钮加 `disabled={isLoading}`，并在 isLoading 时显示"回答中…"。读取该组件确认 `isLoading` prop 是否已传入（若未传入，从 props 加）。

```tsx
<button
  type="button"
  disabled={isLoading}
  onClick={() => setOpen(!open)}
  className={`... ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
>
  {isLoading ? "回答中…" : currentModel}
</button>
```

- [ ] **Step 2: 设置页 LlmConfigForm 加 fallback 配置区**

读取 `apps/web/src/components/settings/llm-config-form.tsx:168-178`（step 2 ModelSelector 区域）。在 ModelSelector 下方加 fallback 分区。state（`:24-31`）加 `fallbackModelId`/`fallbackLlmConfigId`，handleSubmit payload（`:49-56`）带两字段。

step 2 区域加：

```tsx
{step === 2 && (
  <div className="space-y-4">
    <ModelSelector ... />
    <div className="space-y-2 border-t border-border pt-4">
      <label className="text-xs font-medium text-muted-foreground">备用模型 ID（可选，主模型失败时降级）</label>
      <input
        className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-sm"
        value={fallbackModelId}
        onChange={(e) => setFallbackModelId(e.target.value)}
        placeholder="如 deepseek-v4-flash"
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: typecheck + build**

Run: `pnpm --filter @ai-teacher/web typecheck && pnpm --filter @ai-teacher/web build`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/chat/chat-input.tsx apps/web/src/components/settings/llm-config-form.tsx
git commit -m "feat(ui): 回答中禁用模型切换 + 设置页加 fallback 模型配置"
```

---

## Task 6: 收尾 — 质量门控 + 文档同步 + E2E

- [ ] **Step 1: 全量单测 + lint + check:deps + check:docs**

Run: `pnpm test:unit && pnpm lint && pnpm check:deps && pnpm check:docs`
Expected: PASS（check:docs 若因新 API/schema 失败，按提示更新 `docs/设计/API接口.md` 加 abort 路由 + LlmConfig 字段）

- [ ] **Step 2: web build**

Run: `pnpm --filter @ai-teacher/web build`
Expected: PASS

- [ ] **Step 3: E2E — failover/循环检测/切换**

读取 `e2e/chat.spec.ts` 和 `e2e/llm-config.spec.ts`，加：

- 模型回答中切换按钮 disabled 断言（`e2e/llm-config.spec.ts`）
- mock 模型失败时降级轨迹可见断言（若 E2E 用 mock provider，在 mock 里让首次 streamText 抛错）

Run: `pnpm test:e2e e2e/chat.spec.ts e2e/llm-config.spec.ts`
Expected: PASS

- [ ] **Step 4: 文档同步**

按 `文档同步规则.md`：

- `docs/设计/API接口.md`：加 `POST /abort`、LlmConfig fallback 字段、SSE 事件清单（step-start/end/reasoning-delta/failover/loop-warning/usage/context-info/abort）
- `docs/设计/技术架构.md`：agent loop failover/循环检测/abort 通道、SSE 协议统一
- `docs/设计/决策记录.md`：新增 ADR（failover 分层降级、循环检测注入提示+熔断、abort control channel、SSE 协议统一）
- `docs/开发/迭代计划.md` + `docs/开发/迭代详情/`：新增迭代条目

- [ ] **Step 5: 更新开发日志 + 提交**

```bash
git add docs/
git commit -m "docs: 同步 Agent Loop 健壮性迭代（failover/循环检测/abort/SSE协议）"
```
