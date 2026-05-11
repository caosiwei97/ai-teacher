import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import Redis from "ioredis";
import { prisma } from "@ai-teacher/db";
import { chatQueue } from "../services/queue";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const DEFAULT_USER_ID = "seed-user-ai-teacher";


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
  teachingMode: z.enum(["warm", "strict", "interviewer"]).optional(),
});

export const chatRoute = new Hono()
  .post("/", zValidator("json", chatRequestSchema), async (c) => {
    const { sessionId, messages, hidden, teachingMode } = c.req.valid("json");
    const userMessage = messages[messages.length - 1].content;

    let session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    // Auto-create session if not found (empty conversation flow)
    if (!session) {
      const userId = DEFAULT_USER_ID;

      // Ensure user exists (auto-create if needed)
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, name: "AI Teacher User" },
      });

      session = await prisma.session.create({
        data: {
          id: sessionId,
          userId,
          topic: userMessage,
          teachingMode: teachingMode ?? "warm",
          status: "active",
          roadmap: {
            create: {},
          },
        },
      });
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

    await chatQueue.add("chat-turn", {
      messageId: message.id,
      sessionId,
      userContent: userMessage,
      messages,
      hidden: hidden ?? false,
    });

    return c.json({ messageId: message.id }, 202);
  })
  .get("/:sessionId/stream", async (c) => {
    const sessionId = c.req.param("sessionId");

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
  });
