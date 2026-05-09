import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from "zod";

export const generateAssessmentTool: ToolDefinition = {
  name: "generateAssessment",
  description: "节点掌握后生成评估总结卡片",
  parameters: z.object({
    conceptId: z.string().describe("知识点 ID"),
    summary: z.string().describe("总结性评价"),
    reviewTable: z
      .array(
        z.object({
          points: z.string().describe("要点"),
          yourAnswer: z.string().describe("用户回答"),
          accuracy: z.string().describe("准确度"),
        }),
      )
      .describe("回顾表格"),
    coreTags: z.array(z.string()).describe("核心要点标签"),
    nextNodeTitle: z.string().describe("下一节标题"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
  promptSnippet: `**generateAssessment 工具**：当掌握度 ≥ 80% 时调用，生成评估卡片（包含总结、回顾表格、核心标签、下一节标题）。`,
  promptGuidelines: [
    "仅在 assessMastery 分数 ≥ 80 后调用",
    "reviewTable 应包含本轮讨论的 2-4 个关键知识点",
    "coreTags 控制在 3-5 个",
  ],
};
