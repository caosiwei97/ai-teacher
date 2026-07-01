import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import {
  calibratePromptBreakdown,
  estimatePromptBreakdown,
} from "./context-breakdown";

describe("estimatePromptBreakdown", () => {
  it("separates system, conversation, built-in tools, and MCP tools", () => {
    const messages = [
      { role: "system", content: "额外系统约束" },
      { role: "user", content: "请解释闭包" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "先检索资料。" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "retrieveContext",
            input: { query: "闭包" },
          },
          {
            type: "tool-call",
            toolCallId: "call-2",
            toolName: "mcp__github__search_code",
            input: { query: "closure" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "retrieveContext",
            output: { type: "text", value: "内置工具结果" },
          },
          {
            type: "tool-result",
            toolCallId: "call-2",
            toolName: "mcp__github__search_code",
            output: { type: "text", value: "MCP 工具结果" },
          },
        ],
      },
    ] as ModelMessage[];

    const result = estimatePromptBreakdown({
      system: "你是一名 AI 私教",
      messages,
      tools: [
        {
          name: "retrieveContext",
          description: "检索学习资料",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
        {
          name: "mcp__github__search_code",
          description: "搜索代码",
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
      ],
    });

    expect(result.system).toBeGreaterThan(0);
    expect(result.user).toBeGreaterThan(0);
    expect(result.assistant).toBeGreaterThan(0);
    expect(result.tools).toBeGreaterThan(0);
    expect(result.mcpTools).toBeGreaterThan(0);
  });
});

describe("calibratePromptBreakdown", () => {
  it("scales category estimates to the provider input token total", () => {
    const result = calibratePromptBreakdown(
      {
        system: 100,
        user: 50,
        assistant: 25,
        tools: 20,
        mcpTools: 5,
      },
      1_000,
    );

    expect(result).toEqual({
      system: 500,
      user: 250,
      assistant: 125,
      tools: 100,
      mcpTools: 25,
    });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(
      1_000,
    );
  });

  it("preserves the exact total after integer rounding", () => {
    const result = calibratePromptBreakdown(
      {
        system: 1,
        user: 1,
        assistant: 1,
        tools: 1,
        mcpTools: 1,
      },
      7,
    );

    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(7);
  });
});
