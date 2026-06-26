import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";
import { ProfileService } from "@ai-teacher/shared/services/profile-service";

const updateSessionSchema = z.object({
  status: z.enum(["active", "completed", "archived"]),
});

const sessionIncludes = {
  source: {
    select: {
      id: true,
      title: true,
      type: true,
    },
  },
  messages: {
    orderBy: { createdAt: "asc" },
  },
  roadmap: {
    include: {
      nodes: {
        orderBy: { index: "asc" },
      },
    },
  },
  user: {
    include: {
      profile: true,
    },
  },
} as const;

async function updateProfileAfterCompletion(
  userId: string,
  session: {
    topic: string;
    roadmap: {
      nodes: Array<{
        title: string;
        status: string;
        masteryScore: number;
      }>;
    } | null;
  },
) {
  try {
    const nodes = session.roadmap?.nodes ?? [];
    const masteredNodes = nodes
      .filter((n) => n.status === "mastered" || n.masteryScore >= 80)
      .map((n) => n.title);
    const unmasteredNodes = nodes
      .filter((n) => n.status !== "mastered" && n.masteryScore < 80)
      .map((n) => n.title);

    await ProfileService.updateAfterSession(userId, {
      topic: session.topic,
      masteredNodes,
      totalNodes: nodes.length,
      strengths: masteredNodes,
      weaknesses: unmasteredNodes,
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[sessions] failed to update profile", error);
  }
}

export const sessionDetailRoute = new Hono()
  .get("/", async (c) => {
    const sessionId = c.req.param("sessionId");

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: sessionIncludes,
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    return c.json({ session });
  })
  .patch("/", zValidator("json", updateSessionSchema), async (c) => {
    const sessionId = c.req.param("sessionId");
    const parsed = c.req.valid("json");

    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, userId: true },
    });

    if (!existingSession) {
      return c.json({ error: "Session not found" }, 404);
    }

    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: parsed.status,
      },
      include: sessionIncludes,
    });

    if (
      parsed.status === "completed" &&
      existingSession.status !== "completed"
    ) {
      void updateProfileAfterCompletion(existingSession.userId, session);
    }

    return c.json({ session });
  })
  .delete("/", async (c) => {
    const sessionId = c.req.param("sessionId");

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const archivedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "archived",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return c.json({ success: true, session: archivedSession });
  });
