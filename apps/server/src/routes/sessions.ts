import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";

const createSessionSchema = z.object({
  userId: z.string().min(1),
  topic: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  teachingMode: z.enum(["warm", "strict", "interviewer"]).optional(),
  llmConfigId: z.string().optional(),
});

export const sessionsRoute = new Hono()
  .post("/", zValidator("json", createSessionSchema), async (c) => {
    const { userId, topic, sourceId, teachingMode, llmConfigId } = c.req.valid("json");

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

    // Create session with empty roadmap — nodes will be generated
    // after diagnostic assessment based on learner's level
    const session = await prisma.session.create({
      data: {
        userId,
        topic,
        sourceId,
        llmConfigId,
        teachingMode: teachingMode ?? "warm",
        status: "active",
        roadmap: {
          create: {},
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
          activeMode: session.activeMode,
          llmConfigId: session.llmConfigId,
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
