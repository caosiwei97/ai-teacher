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
import { createProviderForConfig, getFallbackProvider } from "../agent/provider-registry.js";
import { decrypt } from "../../../server/src/services/crypto.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const STREAM_TIMEOUT_MS = 120_000;

export interface RoadmapNodePayload {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
}

export interface ChatTurnJobData {
  messageId: string;
  sessionId: string;
  userContent: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  hidden?: boolean;
  topic?: string;
  teachingMode?: string;
  userId?: string;
  roadmapNodes?: RoadmapNodePayload[];
  llmConfigId?: string;
}

function createPublisher(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

async function getProviderForJob(llmConfigId?: string) {
  if (llmConfigId) {
    const config = await prisma.llmConfig.findUnique({ where: { id: llmConfigId } });
    if (!config) throw new Error(`LlmConfig ${llmConfigId} not found`);
    const apiKey = decrypt(config.encryptedKey);
    return createProviderForConfig({
      provider: config.provider,
      apiKey,
      baseUrl: config.baseUrl ?? undefined,
    });
  }
  return getFallbackProvider();
}

export function createChatTurnWorker(
  connection?: Redis,
): BullWorker<ChatTurnJobData> {
  const publisher = createPublisher();

  const worker = new BullWorker<ChatTurnJobData>(
    "chat-turn",
    async (job) => {
      const { messageId, sessionId, messages } = job.data;
      const channel = `chat:${sessionId}`;

      console.log(
        `[chat-turn] processing job ${job.id} for session ${sessionId}`,
      );

      await prisma.message.update({
        where: { id: messageId },
        data: { status: "processing" },
      });

      try {
        const hasPayloadData = job.data.topic !== undefined && job.data.userId !== undefined;

        let topic: string;
        let teachingMode: string;
        let userId: string;
        let roadmapNodes: RoadmapNodePayload[];
        let userProfile: Parameters<typeof buildLearnerProfile>[0] = null;

        if (hasPayloadData) {
          topic = job.data.topic!;
          teachingMode = job.data.teachingMode ?? "warm";
          userId = job.data.userId!;
          roadmapNodes = job.data.roadmapNodes ?? [];

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
          });
          if (!user) throw new Error(`User ${userId} not found`);
          userProfile = user.profile;
        } else {
          console.log(`[chat-turn] job ${job.id} missing payload data, falling back to DB query`);
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

          topic = session.topic;
          teachingMode = session.teachingMode ?? "warm";
          userId = session.userId;
          userProfile = session.user.profile;
          roadmapNodes = session.roadmap.nodes.map((n) => ({
            id: n.id,
            index: n.index,
            title: n.title,
            description: n.description,
            status: n.status,
            masteryScore: n.masteryScore,
          }));
        }

        const hasNodes = roadmapNodes.length > 0;

        const currentNode = hasNodes
          ? (roadmapNodes.find((node) => node.status === "in-progress") ??
            roadmapNodes.find((node) => node.status === "not-started") ??
            roadmapNodes.find((node) => node.status !== "mastered") ??
            roadmapNodes.at(-1))
          : null;

        const masteredNodes = hasNodes
          ? roadmapNodes
              .filter((node) => node.status === "mastered" || node.masteryScore >= 80)
              .map((node) => node.title)
          : [];

        const subagentRegistry = createSubagentRegistry();
        const providerFn = await getProviderForJob(job.data.llmConfigId);
        const toolRegistry = createTutorToolRegistry(subagentRegistry, providerFn);
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
          model: providerFn("deepseek-v4-flash"),
        });

        const initialState: TutorState = {
          sessionId,
          topic,
          currentNodeId: currentNode?.id ?? "pending",
          currentNode: currentNode
            ? { id: currentNode.id, title: currentNode.title, description: currentNode.description }
            : { id: "pending", title: topic, description: `等待诊断后生成学习路线` },
          allNodes: hasNodes
            ? roadmapNodes.map((n) => ({
                id: n.id,
                index: n.index,
                title: n.title,
                status: n.status,
              }))
            : [],
          masteredNodes,
          learnerProfile: buildLearnerProfile(userProfile),
          teachingMode: (teachingMode as "warm" | "strict") ?? "warm",
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
          userId,
          publisher,
          channel,
          contextManager,
          subagentRegistry,
          providerFn,
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
          graphResult.assistantText ?? "",
          graphResult.toolResults ?? [],
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
