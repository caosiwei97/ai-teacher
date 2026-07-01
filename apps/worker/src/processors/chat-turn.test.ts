import { describe, expect, it } from "vitest";
import { z } from "zod";
import { scopeToolsForTurn } from "./chat-turn";
import type { ToolDefinition } from "../agent/types";

function tool(name: string): ToolDefinition {
  return {
    name,
    description: name,
    inputSchema: z.object({}),
    execute: async () => ({ success: true }),
  };
}

describe("chat turn tool scoping", () => {
  it("自动续接轮不暴露掌握评估和诊断工具", () => {
    const scoped = scopeToolsForTurn(
      [
        tool("assessMastery"),
        tool("generateRoadmap"),
        tool("askQuestion"),
        tool("renderUI"),
        tool("pushCode"),
        tool("executeCode"),
        tool("retrieveContext"),
      ],
      "[Continue] 开始教学知识点：货币的时间价值",
    ).map((def) => def.name);

    expect(scoped).toEqual([
      "renderUI",
      "pushCode",
      "executeCode",
      "retrieveContext",
    ]);
  });

  it("普通互动回应保留完整工具集", () => {
    const defs = [tool("assessMastery"), tool("renderUI")];

    expect(
      scopeToolsForTurn(
        defs,
        "[Interactive Response] 答案：收益再投入",
      ),
    ).toBe(defs);
  });
});
