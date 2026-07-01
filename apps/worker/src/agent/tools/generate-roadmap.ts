import type { ToolDefinition } from "../types";
import { z } from "zod";
import { generateObject } from "ai";
import { RoadmapOutput } from "@ai-teacher/shared";
import { getFallbackProvider } from "@ai-teacher/shared/services/provider-registry";

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

    const model = getFallbackProvider()("deepseek-v4-flash");
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
      include: {
        roadmap: {
          include: {
            nodes: { orderBy: { index: "asc" } },
          },
        },
      },
    });

    if (!session?.roadmap) {
      return { success: false, error: "Session or roadmap not found" };
    }

    if (session.roadmap.nodes.length > 0) {
      const plainNodes = JSON.parse(JSON.stringify(session.roadmap.nodes));
      const firstNode =
        session.roadmap.nodes.find((node) => node.status === "in_progress") ??
        session.roadmap.nodes[0];
      const masteredNodes = session.roadmap.nodes.filter(
        (node) => node.status === "mastered" || node.masteryScore >= 80,
      ).length;
      return {
        success: true,
        skipped: true,
        reason: "roadmap_already_exists",
        roadmapTitle: session.topic,
        nodes: session.roadmap.nodes.map((n) => ({
          id: n.id,
          index: n.index,
          title: n.title,
          description: n.description,
          status: n.status,
        })),
        roadmapUpdate: { nodes: plainNodes },
        sessionUpdate: {
          masteredNodes,
          totalNodes: session.roadmap.nodes.length,
        },
        firstNode: {
          id: firstNode?.id,
          title: firstNode?.title,
          description: firstNode?.description,
        },
      };
    }

    const firstNodeStatus = "in_progress";
    await prisma.node.createMany({
      data: roadmap.nodes.map((node, i) => ({
        index: node.index,
        title: node.title,
        description: node.description,
        status: i === 0 ? firstNodeStatus : "not_started",
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
      // Strip Prisma objects to plain JSON (Date → ISO string) to avoid
      // AI SDK ModelMessage[] schema validation errors on subsequent steps.
      roadmapUpdate: { nodes: JSON.parse(JSON.stringify(createdNodes)) },
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
  promptSnippet: `**generateRoadmap 工具**：在诊断摸底完成后、收到学习者答案并分析其水平后，立即调用此工具生成个性化学习路线图。传入学习主题、学习者水平（beginner/intermediate/advanced）、诊断分析和起点建议。系统会根据学习者水平生成合适的学习节点，并自动将第一个节点设为 in_progress。生成完成后不要再输出文字，也不要再次调用 askQuestion；系统会用已生成的路线图自动续接第一课。`,
  promptGuidelines: [
    "必须在诊断摸底完成、分析完学习者水平后才能调用",
    "learnerLevel 要根据诊断答案的实际质量判断，不要默认给 beginner",
    "诊断答案中多个选项都选了最高级 → advanced；选了中级 → intermediate；选了初级 → beginner",
    "生成完成后立即停止本轮，不要输出过渡语；第一课由系统基于新路线图自动续接",
  ],
};
