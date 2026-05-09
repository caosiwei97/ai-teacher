import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from 'zod';

export const recordMisconceptionTool: ToolDefinition = {
  name: "recordMisconception",
  description: "记录学习者的误解与根因",
  inputSchema: z.object({
    area: z.string().describe("误解领域"),
    misconception: z.string().describe("错误认知"),
    rootCause: z.string().describe("误解根因"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
  promptSnippet: `**recordMisconception 工具**：发现学习者存在误解时调用，记录错误认知和根因分析。`,
};
