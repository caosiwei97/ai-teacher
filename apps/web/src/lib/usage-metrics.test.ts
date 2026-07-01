import { describe, expect, it } from "vitest";
import {
  INITIAL_AGENT_ACTIVITY,
  INITIAL_TOKEN_USAGE,
  getCurrentContextTokens,
  mergeUsage,
  recordAgentCall,
} from "./usage-metrics";

describe("mergeUsage", () => {
  it("uses the latest call for current context and accumulates session usage", () => {
    const first = mergeUsage(INITIAL_TOKEN_USAGE, {
      usage: {
        inputTokens: 8_096,
        outputTokens: 645,
        totalTokens: 8_741,
        outputTokenDetails: { reasoningTokens: 167 },
      },
      modelId: "glm-4.7",
      contextWindow: 200_000,
    });
    const second = mergeUsage(first, {
      usage: {
        inputTokens: 9_200,
        outputTokens: 400,
        totalTokens: 9_600,
      },
      modelId: "glm-4.7",
      contextWindow: 200_000,
    });

    expect(second.input).toBe(9_200);
    expect(second.output).toBe(400);
    expect(second.reasoning).toBe(0);
    expect(second.sessionTotal).toBe(18_341);
    expect(second.modelId).toBe("glm-4.7");
    expect(second.contextWindow).toBe(200_000);
    expect(getCurrentContextTokens(second)).toBe(9_600);
  });

  it("keeps the context window unknown when the provider cannot report it", () => {
    const usage = mergeUsage(INITIAL_TOKEN_USAGE, {
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      modelId: "custom-model",
      contextWindow: null,
    });

    expect(usage.contextWindow).toBeNull();
  });
});

describe("recordAgentCall", () => {
  it("counts built-in tools and MCP tools separately while grouping names", () => {
    const first = recordAgentCall(INITIAL_AGENT_ACTIVITY, "retrieveContext");
    const second = recordAgentCall(first, "mcp__github__search_code");
    const third = recordAgentCall(second, "retrieveContext");

    expect(third.toolCalls).toBe(2);
    expect(third.mcpCalls).toBe(1);
    expect(third.items).toEqual([
      { name: "retrieveContext", source: "tool", count: 2 },
      { name: "mcp__github__search_code", source: "mcp", count: 1 },
    ]);
  });
});
