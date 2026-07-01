export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  sessionTotal: number;
  modelId: string | null;
  provider: string | null;
  contextWindow: number | null;
}

export interface UsageEventData {
  usage?: Record<string, unknown>;
  modelId?: string;
  provider?: string;
  contextWindow?: number | null;
}

export interface AgentActivityItem {
  name: string;
  source: "tool" | "mcp";
  count: number;
}

export interface AgentActivity {
  toolCalls: number;
  mcpCalls: number;
  items: AgentActivityItem[];
}

export const INITIAL_TOKEN_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  total: 0,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
  sessionTotal: 0,
  modelId: null,
  provider: null,
  contextWindow: null,
};

export const INITIAL_AGENT_ACTIVITY: AgentActivity = {
  toolCalls: 0,
  mcpCalls: 0,
  items: [],
};

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function mergeUsage(
  prev: TokenUsage,
  event: UsageEventData,
): TokenUsage {
  const usage = event.usage;
  if (!usage) return prev;

  const inputDetails = usage.inputTokenDetails as
    | Record<string, unknown>
    | undefined;
  const outputDetails = usage.outputTokenDetails as
    | Record<string, unknown>
    | undefined;
  const total = numberOr(usage.totalTokens, prev.total);

  return {
    input: numberOr(usage.inputTokens, prev.input),
    output: numberOr(usage.outputTokens, prev.output),
    total,
    cacheRead: numberOr(inputDetails?.cacheReadTokens, 0),
    cacheWrite: numberOr(inputDetails?.cacheWriteTokens, 0),
    reasoning: numberOr(outputDetails?.reasoningTokens, 0),
    sessionTotal: prev.sessionTotal + total,
    modelId: event.modelId ?? prev.modelId,
    provider: event.provider ?? prev.provider,
    contextWindow:
      event.contextWindow === null
        ? null
        : numberOr(event.contextWindow, prev.contextWindow ?? 0) || null,
  };
}

export function getCurrentContextTokens(usage: TokenUsage): number {
  return usage.total || usage.input + usage.output;
}

function getCallSource(toolName: string): AgentActivityItem["source"] {
  return /^(mcp__|mcp:|mcp\/)/i.test(toolName) ? "mcp" : "tool";
}

export function recordAgentCall(
  prev: AgentActivity,
  toolName: string,
): AgentActivity {
  const source = getCallSource(toolName);
  const existingIndex = prev.items.findIndex(
    (item) => item.name === toolName && item.source === source,
  );
  const items = [...prev.items];

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    items[existingIndex] = { ...existing, count: existing.count + 1 };
  } else {
    items.push({ name: toolName, source, count: 1 });
  }

  return {
    toolCalls: prev.toolCalls + (source === "tool" ? 1 : 0),
    mcpCalls: prev.mcpCalls + (source === "mcp" ? 1 : 0),
    items,
  };
}
