import type { PromptContextBreakdown } from "@ai-teacher/shared";

export interface TokenUsage {
  input: number;
  cacheRead: number;
  cacheReadKnown: boolean;
  modelId: string | null;
  provider: string | null;
  contextWindow: number | null;
  contextBreakdown: PromptContextBreakdown | null;
}

export interface UsageEventData {
  usage?: Record<string, unknown>;
  modelId?: string;
  provider?: string;
  contextWindow?: number | null;
  contextBreakdown?: PromptContextBreakdown;
}

export const INITIAL_TOKEN_USAGE: TokenUsage = {
  input: 0,
  cacheRead: 0,
  cacheReadKnown: false,
  modelId: null,
  provider: null,
  contextWindow: null,
  contextBreakdown: null,
};

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
  const cacheReadTokens = inputDetails?.cacheReadTokens;

  return {
    input: numberOr(usage.inputTokens, prev.input),
    cacheRead: numberOr(cacheReadTokens, 0),
    cacheReadKnown:
      typeof cacheReadTokens === "number" && Number.isFinite(cacheReadTokens),
    modelId: event.modelId ?? prev.modelId,
    provider: event.provider ?? prev.provider,
    contextWindow:
      event.contextWindow === null
        ? null
        : numberOr(event.contextWindow, prev.contextWindow ?? 0) || null,
    contextBreakdown: event.contextBreakdown ?? prev.contextBreakdown,
  };
}

export function getCacheHitRate(usage: TokenUsage): number | null {
  if (!usage.cacheReadKnown || usage.input <= 0) return null;
  return Math.min(100, Math.round((usage.cacheRead / usage.input) * 100));
}
