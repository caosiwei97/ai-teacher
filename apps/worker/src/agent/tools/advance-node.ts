import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from "zod";

export const advanceNodeTool: ToolDefinition = {
  name: "advanceNode",
  description: "推进到下一个知识点",
  parameters: z.object({
    currentNodeId: z.string().describe("当前知识点 ID"),
    nextNodeId: z.string().describe("下一个知识点 ID"),
    masteryScore: z.number().describe("当前节点掌握度"),
  }),
  execute: async (params, ctx) => {
    const prisma = ctx.prisma as import("@prisma/client").PrismaClient;
    const p = params as {
      currentNodeId: string;
      nextNodeId: string;
      masteryScore: number;
    };

    await prisma.$transaction([
      prisma.node.update({
        where: { id: p.currentNodeId },
        data: {
          status: "mastered",
          masteryScore: p.masteryScore,
          masteredAt: new Date(),
        },
      }),
      prisma.node.update({
        where: { id: p.nextNodeId },
        data: { status: "in-progress" },
      }),
    ]);

    return { success: true, ...p };
  },
  promptSnippet: `**advanceNode 工具**：当掌握度 ≥ 80% 且已生成评估卡片后调用，推进到下一个知识点。需传入当前节点 id、下一个 not-started 节点 id 和掌握度分数。`,
  promptGuidelines: [
    "必须在 assessMastery (≥80) + generateAssessment 之后才调用",
    "nextNodeId 从知识图谱节点列表中选择下一个 not-started 或 in-progress 节点",
  ],
};
