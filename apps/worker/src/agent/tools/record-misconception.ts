import { tool } from "ai";
import { z } from "zod";

export const recordMisconception = tool({
  description: "记录学习者的误解与根因",
  parameters: z.object({
    area: z.string().describe("误解领域"),
    misconception: z.string().describe("错误认知"),
    rootCause: z.string().describe("误解根因"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
});
