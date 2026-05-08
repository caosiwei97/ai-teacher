import { tool } from "ai";
import { z } from "zod";

export const generateAssessment = tool({
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
});
