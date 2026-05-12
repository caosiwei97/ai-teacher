import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from "zod";
import { generateObject } from "ai";
import { RoadmapOutput } from "@ai-teacher/shared";
import { getProvider } from "../provider";

const ROADMAP_SYSTEM_PROMPT = `你是一个教学设计专家。根据学习主题和学习者的水平，设计结构化的学习路径。

规则：
1. 每个节点是一个可独立评估的知识点
2. 节点按学习顺序排列，后面的依赖前面的
3. 节点粒度适中：太粗无法评估，太细学习节奏被打断
4. 最后一个节点应该是综合应用
5. 生成 5-15 个节点
6. 根据学习者水平调整起点和深度：
   - 初学者：从最基础的概念开始，节点更多更细
   - 中级：跳过基础概念，从核心机制开始
   - 高级：聚焦高级应用和常见误区`;

export const generateRoadmapTool: ToolDefinition = {
  name: "generateRoadmap",
  description:
    "根据学习主题和学习者水平生成个性化学习路线图。在诊断摸底完成后调用，将根据诊断结果为学习者定制学习路径。",
  inputSchema: z.object({
    topic: z.string().describe("学习主题"),
    learnerLevel: z
      .enum(["beginner", "intermediate", "advanced"])
      .describe("学习者的水平等级，根据诊断答案判断"),
    diagnosticSummary: z
      .string()
      .describe("诊断答案的简要分析，说明为什么判定这个水平"),
    startHint: z
      .string()
      .optional()
      .describe(
        "建议从哪个方向开始，例如 '已了解基本概念，需要从核心机制开始'",
      ),
  }),
  execute: async (params, ctx) => {
    const p = params as {
      topic: string;
      learnerLevel: "beginner" | "intermediate" | "advanced";
      diagnosticSummary: string;
      startHint?: string;
    };
    const prisma = ctx.prisma as import("@prisma/client").PrismaClient;

    const levelDesc = {
      beginner: "初学者，对主题基本不了解或只有模糊概念",
      intermediate: "中级，了解基本概念但缺乏深入理解",
      advanced: "高级，有较好的基础但需要系统化提升",
    };

    const userPrompt = `为「${p.topic}」设计学习路线。

学习者水平：${levelDesc[p.learnerLevel]}
诊断分析：${p.diagnosticSummary}
${p.startHint ? `起点建议：${p.startHint}` : ""}`;

    const model = getProvider()("deepseek-v4-flash");
    let roadmap;
    try {
      const result = await generateObject({
        model,
        schema: RoadmapOutput,
        system: ROADMAP_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      roadmap = result.object;
    } catch (e) {
      console.error("[generateRoadmap] LLM failed, using fallback:", e);
      roadmap = {
        title: p.topic,
        nodes: [
          { index: 0, title: `${p.topic} 的整体框架`, description: `先建立 ${p.topic} 的整体地图。` },
          { index: 1, title: `${p.topic} 的核心概念`, description: `拆开 ${p.topic} 的关键术语和基础概念。` },
          { index: 2, title: `${p.topic} 的关键机制`, description: `理解 ${p.topic} 背后的运行逻辑。` },
          { index: 3, title: `${p.topic} 的常见误区`, description: `聚焦 ${p.topic} 里最容易踩坑的地方。` },
          { index: 4, title: `${p.topic} 的综合应用`, description: `把前面的知识串起来解决完整问题。` },
        ],
      };
    }

    const session = await prisma.session.findUnique({
      where: { id: ctx.sessionId },
      include: { roadmap: true },
    });

    if (!session?.roadmap) {
      return { success: false, error: "Session or roadmap not found" };
    }

    const firstNodeStatus = "in-progress";
    await prisma.node.createMany({
      data: roadmap.nodes.map((node, i) => ({
        index: node.index,
        title: node.title,
        description: node.description,
        status: i === 0 ? firstNodeStatus : "not-started",
        roadmapId: session.roadmap!.id,
      })),
    });

    const createdNodes = await prisma.node.findMany({
      where: { roadmapId: session.roadmap.id },
      orderBy: { index: "asc" },
    });

    return {
      success: true,
      roadmapTitle: roadmap.title,
      nodes: createdNodes.map((n) => ({
        id: n.id,
        index: n.index,
        title: n.title,
        description: n.description,
        status: n.status,
      })),
      roadmapUpdate: { nodes: createdNodes },
      sessionUpdate: {
        masteredNodes: 0,
        totalNodes: createdNodes.length,
      },
      firstNode: {
        id: createdNodes[0]?.id,
        title: createdNodes[0]?.title,
        description: createdNodes[0]?.description,
      },
    };
  },
  promptSnippet: `**generateRoadmap 工具**：在诊断摸底完成后、收到学习者答案并分析其水平后，立即调用此工具生成个性化学习路线图。传入学习主题、学习者水平（beginner/intermediate/advanced）、诊断分析和起点建议。系统会根据学习者水平生成合适的学习节点，并自动将第一个节点设为 in-progress。生成完成后你需要立即从第一个知识点开始教学。`,
  promptGuidelines: [
    "必须在诊断摸底完成、分析完学习者水平后才能调用",
    "learnerLevel 要根据诊断答案的实际质量判断，不要默认给 beginner",
    "诊断答案中多个选项都选了最高级 → advanced；选了中级 → intermediate；选了初级 → beginner",
    "生成完成后，说一句简短过渡语（如「太好了，我为你定制了学习路线！」），然后直接开始教第一个知识点，不要重复提及定制路线",
  ],
};
