import { describe, expect, it } from "vitest";
import {
  INITIAL_TOKEN_USAGE,
  getCacheHitRate,
  mergeUsage,
} from "./usage-metrics";

describe("mergeUsage", () => {
  it("uses the latest model call as the current prompt snapshot", () => {
    const first = mergeUsage(INITIAL_TOKEN_USAGE, {
      usage: {
        inputTokens: 8_096,
        outputTokens: 645,
        totalTokens: 8_741,
        inputTokenDetails: { cacheReadTokens: 6_000 },
        outputTokenDetails: { reasoningTokens: 167 },
      },
      modelId: "glm-4.7",
      contextWindow: 200_000,
      contextBreakdown: {
        system: 3_000,
        user: 1_500,
        assistant: 1_000,
        tools: 2_000,
        mcpTools: 596,
      },
    });
    const second = mergeUsage(first, {
      usage: {
        inputTokens: 9_200,
        outputTokens: 400,
        totalTokens: 9_600,
        inputTokenDetails: { cacheReadTokens: 8_000 },
      },
      modelId: "glm-4.7",
      contextWindow: 200_000,
      contextBreakdown: {
        system: 3_200,
        user: 1_700,
        assistant: 1_200,
        tools: 2_400,
        mcpTools: 700,
      },
    });

    expect(second.input).toBe(9_200);
    expect(second.modelId).toBe("glm-4.7");
    expect(second.contextWindow).toBe(200_000);
    expect(second.contextBreakdown?.mcpTools).toBe(700);
    expect(getCacheHitRate(second)).toBe(87);
  });

  it("keeps the context window unknown when the provider cannot report it", () => {
    const usage = mergeUsage(INITIAL_TOKEN_USAGE, {
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      modelId: "custom-model",
      contextWindow: null,
    });

    expect(usage.contextWindow).toBeNull();
    expect(getCacheHitRate(usage)).toBeNull();
  });
});
