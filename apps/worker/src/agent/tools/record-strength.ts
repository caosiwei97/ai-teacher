import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from "zod";

export const recordStrengthTool: ToolDefinition = {
  name: "recordStrength",
  description: "记录学习者在当前知识点上的擅长项",
  parameters: z.object({
    area: z.string().describe("擅长领域"),
    evidence: z.string().describe("证据"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
  promptSnippet: `**recordStrength 工具**：发现学习者对某方面理解出色时调用，记录擅长领域和证据。`,
};
