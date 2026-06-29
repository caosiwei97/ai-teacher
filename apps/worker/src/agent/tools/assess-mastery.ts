import type { ToolDefinition } from "../types";
import { z } from 'zod';

export const assessMasteryTool: ToolDefinition = {
  name: "assessMastery",
  description: "评估学习者对当前知识点的掌握程度",
  inputSchema: z.object({
    conceptId: z.string().describe("知识点 ID"),
    score: z.number().min(0).max(100).describe("掌握度分数"),
    strengths: z.array(z.string()).describe("展示的理解亮点"),
    gaps: z.array(z.string()).describe("盲区"),
    misconceptions: z
      .array(
        z.object({
          belief: z.string().describe("错误认知"),
          rootCause: z.string().describe("根因"),
          resolved: z.boolean().describe("是否已纠正"),
        }),
      )
      .describe("误解列表"),
  }),
  execute: async (params, ctx) => {
    const prisma = ctx.prisma as import("@prisma/client").PrismaClient;
    const p = params as {
      conceptId: string;
      score: number;
      strengths: string[];
      gaps: string[];
      misconceptions: Array<{
        belief: string;
        rootCause: string;
        resolved: boolean;
      }>;
    };

    await prisma.node.update({
      where: { id: p.conceptId },
      data: {
        masteryScore: p.score,
        reviewLog: JSON.parse(JSON.stringify(p)),
        status: p.score >= 80 ? "mastered" : "in_progress",
        masteredAt: p.score >= 80 ? new Date() : null,
      },
    });

    if (p.score >= 80) {
      const node = await prisma.node.findUnique({
        where: { id: p.conceptId },
        include: {
          roadmap: { include: { nodes: { orderBy: { index: "asc" } } } },
        },
      });
      if (node) {
        const nextNode = node.roadmap.nodes
          .filter((n) => n.index > node.index)
          .find((n) => n.status === "not_started");
        if (nextNode) {
          await prisma.node.update({
            where: { id: nextNode.id },
            data: { status: "in_progress" },
          });
        }

        const refreshedNodes = await prisma.node.findMany({
          where: { roadmapId: node.roadmapId },
          orderBy: { index: "asc" },
        });
        // Strip Prisma objects to plain JSON (Date → ISO string) to avoid
        // AI SDK ModelMessage[] schema validation errors on subsequent steps.
        const plainNodes = JSON.parse(JSON.stringify(refreshedNodes));
        const masteredCount = refreshedNodes.filter((n) => n.status === "mastered").length;
        if (nextNode) {
          return {
            success: true,
            ...p,
            roadmapUpdate: { nodes: plainNodes },
            sessionUpdate: {
              masteredNodes: masteredCount,
              totalNodes: refreshedNodes.length,
            },
            instruction: `节点「${node.title}」已掌握。用一句话确认并预告下一节「${nextNode.title}」（例如"✓ 掌握，下一节我们来学 ${nextNode.title}"），然后停止本轮。不要生成掌握总结报告，不要庆祝长文，不要复述已学概念。系统会自动开始下一节教学。`,
            activatedNextNode: { id: nextNode.id, title: nextNode.title },
          };
        }
        return {
          success: true,
          ...p,
          roadmapUpdate: { nodes: plainNodes },
          sessionUpdate: {
            masteredNodes: masteredCount,
            totalNodes: refreshedNodes.length,
          },
          instruction: `全部知识点已掌握！用一句话简短祝贺学习成果，然后结束本轮。不要生成长篇总结报告。`,
        };
      }
    }

    return { success: true, ...p };
  },
  promptSnippet: `**assessMastery 工具**：每 2-3 轮充分互动后调用，评估学习者对当前知识点的掌握程度。传入 conceptId、score(0-100)、strengths/gaps/misconceptions。当分数 ≥ 80 时系统会自动推进到下一个知识点并返回 instruction 字段，你需要按 instruction 执行自动过渡。`,
  promptGuidelines: [
    "不要每轮都调用——先进行 2-3 轮苏格拉底式追问，充分互动后再评估",
    "分数要基于学生实际回答质量，不要给虚高分数",
    "misconceptions 中的 resolved 字段标记该误解是否已在本轮对话中纠正",
  ],
};
