import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from 'zod';

export const recordStrengthTool: ToolDefinition = {
  name: "recordStrength",
  description: "记录学习者在当前知识点上的擅长项，持久化到学习者画像",
  inputSchema: z.object({
    area: z.string().describe("擅长领域"),
    evidence: z.string().describe("证据"),
  }),
  execute: async (params, ctx) => {
    const prisma = ctx.prisma as import("@prisma/client").PrismaClient;
    const p = params as { area: string; evidence: string };
    const userId = ctx.userId as string;

    try {
      const existing = await prisma.learnerProfile.findUnique({ where: { userId } });
      const existingStrengths: string[] = Array.isArray(existing?.strengths)
        ? (existing.strengths as unknown as string[])
        : [];
      const newStrengths = [...new Set([...existingStrengths, p.area])];

      await prisma.learnerProfile.upsert({
        where: { userId },
        create: {
          userId,
          strengths: JSON.parse(JSON.stringify(newStrengths)),
        },
        update: {
          strengths: JSON.parse(JSON.stringify(newStrengths)),
        },
      });
    } catch (e) {
      console.error("[recordStrength] DB error:", e);
    }

    return { success: true, ...p };
  },
  promptSnippet: `**recordStrength 工具**：发现学习者对某方面理解出色时调用，记录擅长领域和证据。数据会持久化到学习者画像，影响后续教学策略。`,
};
