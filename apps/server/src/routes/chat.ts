import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import { prisma } from "@ai-teacher/db";
import { chatQueue } from "../services/queue";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
  hidden: z.boolean().optional().default(false),
  llmConfigId: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function subscribeAndStream(c: any, sessionId: string) {
  return streamSSE(c, async (stream) => {
    const subscriber = new Redis(REDIS_URL);
    const channel = `chat:${sessionId}`;

    const incoming: Array<{ ch: string; payload: string }> = [];
    let wake: (() => void) | null = null;
    let closed = false;

    const onMessage = (ch: string, payload: string) => {
      incoming.push({ ch, payload });
      wake?.();
    };

    subscriber.on("message", onMessage);
    await subscriber.subscribe(channel);

    stream.onAbort(() => {
      closed = true;
      subscriber.off("message", onMessage);
      subscriber.disconnect();
      wake?.();
    });

    const next = (): Promise<void> =>
      new Promise((resolve) => {
        if (incoming.length > 0 || closed) {
          resolve();
          return;
        }
        wake = resolve;
      });

    while (!closed) {
      await next();

      while (incoming.length > 0 && !closed) {
        const { ch, payload } = incoming.shift()!;

        if (ch !== channel) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const type = parsed.type as string | undefined;

        await stream.writeSSE({
          event: "message",
          data: JSON.stringify(parsed),
        });

        if (type === "done" || type === "error") {
          closed = true;
          break;
        }
      }
    }

    subscriber.off("message", onMessage);
    subscriber.disconnect();
  });
}

export const chatRoute = new Hono()
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const { sessionId, messages, hidden, llmConfigId } = c.req.valid("json");
    const userMessage = messages[messages.length - 1].content;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        roadmap: {
          include: { nodes: { orderBy: { index: "asc" as const } } },
        },
      },
    });

    // 会话必须由前端「发消息才建会话」路径（POST /api/sessions）预先创建。
    // 不存在则返回 404，让前端漏建暴露为可排查错误，而非静默兜底创建掩盖 bug。
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const message = await prisma.message.create({
      data: {
        sessionId,
        role: "learner",
        type: "text",
        content: userMessage,
        status: "sending",
        hidden: hidden ?? false,
      },
    });

    const roadmapNodes = session.roadmap?.nodes?.map((n) => ({
      id: n.id,
      index: n.index,
      title: n.title,
      description: n.description,
      status: n.status,
      masteryScore: n.masteryScore,
      memoryStrength: n.memoryStrength,
      lastReviewedAt: n.lastReviewedAt,
      nextReviewAt: n.nextReviewAt,
      reviewInterval: n.reviewInterval,
    })) ?? [];

    await chatQueue.add("chat-turn", {
      messageId: message.id,
      sessionId,
      userContent: userMessage,
      messages,
      hidden: hidden ?? false,
      topic: session.topic,
      teachingMode: session.teachingMode ?? "warm",
      activeMode: session.activeMode,
      userId: session.userId,
      roadmapNodes,
      llmConfigId: llmConfigId ?? session.llmConfigId,
    });

    return subscribeAndStream(c, sessionId);
  })
  .get("/:sessionId/stream", async (c) => {
    const sessionId = c.req.param("sessionId");
    return subscribeAndStream(c, sessionId);
  });
