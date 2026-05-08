import { tool } from "ai";
import { z } from "zod";

export const recordStrength = tool({
  description: "记录学习者在当前知识点上的擅长项",
  parameters: z.object({
    area: z.string().describe("擅长领域"),
    evidence: z.string().describe("证据"),
  }),
  execute: async (params) => {
    return { success: true, ...params };
  },
});
