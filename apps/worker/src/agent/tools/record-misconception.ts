import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from 'zod';

export const recordMisconceptionTool: ToolDefinition = {
  name: "recordMisconception",
  description: "记录学习者的误解与根因，持久化到学习者画像",
  inputSchema: z.object({
    area: z.string().describe("误解领域"),
    misconception: z.string().describe("错误认知"),
    rootCause: z.string().describe("误解根因"),
  }),
  execute: async (params, ctx) => {
    const prisma = ctx.prisma as import("@prisma/client").PrismaClient;
    const p = params as { area: string; misconception: string; rootCause: string };
    const userId = ctx.userId as string;

    try {
      const existing = await prisma.learnerProfile.findUnique({ where: { userId } });
      const existingWeaknesses: string[] = Array.isArray(existing?.weaknesses)
        ? (existing.weaknesses as unknown as string[])
        : [];
      const existingPatterns: Array<{ area: string; misconception: string }> =
        Array.isArray(existing?.misconceptionPatterns)
          ? (existing.misconceptionPatterns as unknown as Array<{ area: string; misconception: string }>)
          : [];

      const newWeaknesses = [...new Set([...existingWeaknesses, p.area])];
      const newPatterns = [...existingPatterns, { area: p.area, misconception: p.misconception }];

      await prisma.learnerProfile.upsert({
        where: { userId },
        create: {
          userId,
          weaknesses: JSON.parse(JSON.stringify(newWeaknesses)),
          misconceptionPatterns: JSON.parse(JSON.stringify(newPatterns)),
        },
        update: {
          weaknesses: JSON.parse(JSON.stringify(newWeaknesses)),
          misconceptionPatterns: JSON.parse(JSON.stringify(newPatterns)),
        },
      });
    } catch (e) {
      console.error("[recordMisconception] DB error:", e);
    }

    return { success: true, ...p };
  },
  promptSnippet: `**recordMisconception 工具**：发现学习者存在误解时调用，记录错误认知和根因分析。数据会持久化到学习者画像，帮助后续避开同类误区。`,
};
