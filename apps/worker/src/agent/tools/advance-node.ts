import { tool } from "ai";
import { z } from "zod";

export const advanceNode = tool({
  description: "推进到下一个知识点",
  parameters: z.object({
    currentNodeId: z.string().describe("当前知识点 ID"),
    nextNodeId: z.string().describe("下一个知识点 ID"),
    masteryScore: z.number().describe("当前节点掌握度"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
});
