import { Worker as BullWorker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@ai-teacher/db";
import { TutorAgent } from "../agent/tutor";
import { MessageService } from "../agent/services/message-service";
import { buildLearnerProfile } from "../lib/learner-profile";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const STREAM_TIMEOUT_MS = 120_000;

export interface ChatTurnJobData {
  messageId: string;
  sessionId: string;
  userContent: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

function createPublisher(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

export function createChatTurnWorker(
  connection?: Redis,
): BullWorker<ChatTurnJobData> {
  const publisher = createPublisher();

  const worker = new BullWorker<ChatTurnJobData>(
    "chat-turn",
    async (job) => {
      const { messageId, sessionId, userContent, messages } = job.data;
      const channel = `chat:${sessionId}`;

      console.log(
        `[chat-turn] processing job ${job.id} for session ${sessionId}`,
      );

      await prisma.message.update({
        where: { id: messageId },
        data: { status: "processing" },
      });

      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
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
          },
        });

        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        if (!session.roadmap || session.roadmap.nodes.length === 0) {
          throw new Error(`Session ${sessionId} has no roadmap`);
        }

        const currentNode =
          session.roadmap.nodes.find((node) => node.status !== "mastered") ??
          session.roadmap.nodes.at(-1);

        if (!currentNode) {
          throw new Error(`Session ${sessionId} has no current node`);
        }

        const masteredNodes = session.roadmap.nodes
          .filter(
            (node) => node.status === "mastered" || node.masteryScore >= 80,
          )
          .map((node) => node.title);

        const agent = new TutorAgent();
        const result = agent.run({
          topic: session.topic,
          currentNode: {
            id: currentNode.id,
            title: currentNode.title,
            description: currentNode.description,
          },
          allNodes: session.roadmap.nodes.map((n) => ({
            id: n.id,
            index: n.index,
            title: n.title,
            status: n.status,
          })),
          masteredNodes,
          learnerProfile: buildLearnerProfile(session.user.profile),
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Stream timeout")),
            STREAM_TIMEOUT_MS,
          ),
        );

        let assistantText = "";
        const toolResults: Array<{ toolName: string; result: unknown }> = [];

        await Promise.race([
          (async () => {
            for await (const event of (await result).fullStream) {
              switch (event.type) {
                case "text-delta": {
                  assistantText += event.textDelta;
                  await publisher.publish(
                    channel,
                    JSON.stringify({
                      type: "text-delta",
                      content: event.textDelta,
                    }),
                  );
                  break;
                }
                case "tool-call": {
                  await publisher.publish(
                    channel,
                    JSON.stringify({
                      type: "tool-call",
                      data: {
                        toolName: event.toolName,
                        args: event.args,
                      },
                    }),
                  );
                  break;
                }
                case "tool-result": {
                  toolResults.push({
                    toolName: event.toolName,
                    result: event.result,
                  });
                  await publisher.publish(
                    channel,
                    JSON.stringify({
                      type: "tool-result",
                      data: {
                        toolName: event.toolName,
                        result: event.result,
                      },
                    }),
                  );
                  break;
                }
                case "error": {
                  throw event.error;
                }
              }
            }
          })(),
          timeoutPromise,
        ]);

        await MessageService.persistTurn(
          sessionId,
          userContent,
          assistantText,
          toolResults,
        );

        await prisma.message.update({
          where: { id: messageId },
          data: { status: "completed" },
        });

        await publisher.publish(
          channel,
          JSON.stringify({ type: "done" }),
        );

        console.log(
          `[chat-turn] completed job ${job.id} for session ${sessionId}`,
        );
      } catch (error) {
        console.error(
          `[chat-turn] error in job ${job.id} for session ${sessionId}:`,
          error,
        );

        await prisma.message.update({
          where: { id: messageId },
          data: { status: "failed" },
        });

        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await publisher.publish(
          channel,
          JSON.stringify({ type: "error", message: errorMessage }),
        );

        throw error;
      }
    },
    {
      connection: connection ?? {
        host: new URL(REDIS_URL).hostname,
        port: Number(new URL(REDIS_URL).port),
      },
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[chat-turn] job ${job?.id} failed:`,
      err.message,
    );
  });

  worker.on("completed", (job) => {
    console.log(`[chat-turn] job ${job.id} completed`);
  });

  worker.on("closing", () => {
    publisher.quit().catch(() => {});
  });

  return worker;
}
