import { Worker as BullWorker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@ai-teacher/db";
import { PrismaCheckpointStore, type TutorState } from "@ai-teacher/agent";
import { StructuredSummarySchema } from "@ai-teacher/shared";
import { getTutorGraph, type TutorGraphContext } from "../graphs/tutor-graph";
import { createTutorToolRegistry } from "../agent/tools/create-tools";
import { createSubagentRegistry } from "../agent/subagents";
import { MessageService } from "../agent/services/message-service";
import { buildLearnerProfile } from "../lib/learner-profile";
import { ContextManager } from "../agent/context-manager";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const STREAM_TIMEOUT_MS = 120_000;

export interface ChatTurnJobData {
  messageId: string;
  sessionId: string;
  userContent: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  hidden?: boolean;
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
      const { messageId, sessionId, userContent, messages, hidden } = job.data;
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
            messages: { orderBy: { createdAt: "asc" } },
            roadmap: {
              include: { nodes: { orderBy: { index: "asc" } } },
            },
            user: { include: { profile: true } },
          },
        });

        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (!session.roadmap) {
          throw new Error(`Session ${sessionId} has no roadmap`);
        }

        const hasNodes = session.roadmap.nodes.length > 0;

        const currentNode = hasNodes
          ? (session.roadmap.nodes.find((node) => node.status === "in-progress") ??
            session.roadmap.nodes.find((node) => node.status === "not-started") ??
            session.roadmap.nodes.find((node) => node.status !== "mastered") ??
            session.roadmap.nodes.at(-1))
          : null;

        const masteredNodes = hasNodes
          ? session.roadmap.nodes
              .filter((node) => node.status === "mastered" || node.masteryScore >= 80)
              .map((node) => node.title)
          : [];

        const subagentRegistry = createSubagentRegistry();
        const toolRegistry = createTutorToolRegistry(subagentRegistry);
        const checkpoint = new PrismaCheckpointStore(prisma);

        const contextManager = new ContextManager({
          loadSummary: async (sid) => {
            const s = await prisma.session.findUnique({ where: { id: sid }, select: { summary: true } });
            if (!s?.summary) return null;
            const parsed = StructuredSummarySchema.safeParse(s.summary);
            return parsed.success ? parsed.data : null;
          },
          saveSummary: async (sid, summary) => {
            await prisma.session.update({ where: { id: sid }, data: { summary: JSON.parse(JSON.stringify(summary)) } });
          },
        });

        const initialState: TutorState = {
          sessionId,
          topic: session.topic,
          currentNodeId: currentNode?.id ?? "pending",
          currentNode: currentNode
            ? { id: currentNode.id, title: currentNode.title, description: currentNode.description }
            : { id: "pending", title: session.topic, description: `等待诊断后生成学习路线` },
          allNodes: hasNodes
            ? session.roadmap.nodes.map((n) => ({
                id: n.id,
                index: n.index,
                title: n.title,
                status: n.status,
              }))
            : [],
          masteredNodes,
          learnerProfile: buildLearnerProfile(session.user.profile),
          teachingMode: (session.teachingMode as "warm" | "strict") ?? "warm",
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        };

        const graphCtx: TutorGraphContext = {
          toolRegistry,
          checkpoint,
          prisma,
          sessionId,
          userId: session.userId,
          publisher,
          channel,
          contextManager,
          subagentRegistry,
        };

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Stream timeout")), STREAM_TIMEOUT_MS),
        );

        const graphResult = await Promise.race([
          getTutorGraph().execute(initialState, graphCtx),
          timeoutPromise,
        ]);

        await MessageService.persistTurn(
          sessionId,
          userContent,
          graphResult.assistantText ?? "",
          graphResult.toolResults ?? [],
          hidden,
        );

        await prisma.message.update({
          where: { id: messageId },
          data: { status: "completed" },
        });

        await publisher.publish(channel, JSON.stringify({ type: "done" }));

        console.log(`[chat-turn] completed job ${job.id} for session ${sessionId}`);
      } catch (error) {
        console.error(
          `[chat-turn] error in job ${job.id} for session ${sessionId}:`,
          error,
        );

        await prisma.message.update({
          where: { id: messageId },
          data: { status: "failed" },
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
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
    console.error(`[chat-turn] job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.log(`[chat-turn] job ${job.id} completed`);
  });

  worker.on("closing", () => {
    publisher.quit().catch(() => {});
  });

  return worker;
}
