import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";

const createSessionSchema = z.object({
  userId: z.string().min(1),
  topic: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  teachingMode: z.enum(["warm", "strict"]).optional(),
});

function buildFallbackNodes(topic: string) {
  return [
    {
      index: 0,
      title: `${topic} 的整体框架`,
      description: `先建立 ${topic} 的整体地图，知道这个主题在解决什么问题。`,
      status: "not-started",
    },
    {
      index: 1,
      title: `${topic} 的核心概念`,
      description: `拆开 ${topic} 的关键术语和基础概念，避免后面混淆。`,
      status: "not-started",
    },
    {
      index: 2,
      title: `${topic} 的关键机制`,
      description: `理解 ${topic} 背后的运行逻辑、因果关系和判断依据。`,
      status: "not-started",
    },
    {
      index: 3,
      title: `${topic} 的常见误区`,
      description: `聚焦 ${topic} 里最容易踩坑或想偏的地方。`,
      status: "not-started",
    },
    {
      index: 4,
      title: `${topic} 的综合应用`,
      description: `把前面的知识串起来，能够用 ${topic} 解决完整问题。`,
      status: "not-started",
    },
  ];
}

export const sessionsRoute = new Hono()
  .post("/", zValidator("json", createSessionSchema), async (c) => {
    const { userId, topic, sourceId, teachingMode } = c.req.valid("json");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (sourceId) {
      const source = await prisma.source.findFirst({
        where: { id: sourceId, userId },
        select: { id: true },
      });

      if (!source) {
        return c.json({ error: "Source not found for user" }, 404);
      }
    }

    const nodeData = buildFallbackNodes(topic);

    const session = await prisma.session.create({
      data: {
        userId,
        topic,
        sourceId,
        teachingMode: teachingMode ?? "warm",
        status: "active",
        roadmap: {
          create: {
            nodes: {
              create: nodeData,
            },
          },
        },
      },
      include: {
        roadmap: {
          include: {
            nodes: {
              orderBy: { index: "asc" },
            },
          },
        },
      },
    });

    return c.json({ session }, 201);
  })
  .get("/", async (c) => {
    const userId = c.req.query("userId") ?? "";

    const parsed = z.object({ userId: z.string().min(1) }).safeParse({ userId });
    if (!parsed.success) {
      return c.json(
        { error: "userId is required", details: z.flattenError(parsed.error) },
        400,
      );
    }

    const sessions = await prisma.session.findMany({
      where: {
        userId: parsed.data.userId,
        status: {
          notIn: ["archived"],
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        source: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        roadmap: {
          include: {
            nodes: {
              orderBy: { index: "asc" },
            },
          },
        },
      },
    });

    return c.json({
      sessions: sessions.map((session) => {
        const nodes = session.roadmap?.nodes ?? [];
        const currentNode =
          nodes.find((node) => node.status !== "mastered") ?? nodes.at(-1) ?? null;
        const masteredNodes = nodes.filter(
          (node) => node.status === "mastered" || node.masteryScore >= 80,
        ).length;

        return {
          id: session.id,
          userId: session.userId,
          topic: session.topic,
          sourceId: session.sourceId,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          source: session.source,
          progress: {
            totalNodes: nodes.length,
            masteredNodes,
            currentNodeId: currentNode?.id ?? null,
            currentNodeTitle: currentNode?.title ?? null,
          },
        };
      }),
    });
  });
