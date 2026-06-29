import { Worker as BullWorker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@ai-teacher/db";
import { StructuredSummarySchema } from "@ai-teacher/shared";
import { tool as aiTool, type Tool } from "ai";
import { runAgentLoop } from "../agent/run-agent-loop";
import { tutorToolDefinitions, reviewToolDefinitions } from "../agent/tools/create-tools";
import { createDelegateTaskTool } from "../agent/tools/delegate-task";
import { subagentConfigs } from "../agent/subagents";
import { MessageService } from "../agent/services/message-service";
import { buildLearnerProfile } from "../lib/learner-profile";
import { ContextManager } from "../agent/context-manager";
import { buildTutorSystemPrompt } from "../agent/prompts/tutor";
import { buildReviewSystemPrompt } from "../agent/prompts/review";
import { selectDueReviewNodes } from "@ai-teacher/shared/services/spaced-repetition";
import {
  createProviderForConfig,
  getFallbackProvider,
} from "@ai-teacher/shared/services/provider-registry";
import { decrypt } from "@ai-teacher/shared/services/crypto";
import { resolveProviderConfig } from "@ai-teacher/shared/services/provider-select";
import type { ToolDefinition, ToolExecutionContext } from "../agent/types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const STREAM_TIMEOUT_MS = 120_000;

export interface RoadmapNodePayload {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
  memoryStrength: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  reviewInterval: number;
}

export interface ChatTurnJobData {
  messageId: string;
  sessionId: string;
  userContent: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  hidden?: boolean;
  topic?: string;
  teachingMode?: string;
  activeMode?: string;
  userId?: string;
  roadmapNodes?: RoadmapNodePayload[];
  llmConfigId?: string;
}

function createPublisher(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null });
}

interface LlmJobConfig {
  providerFn: (modelId: string) => ReturnType<ReturnType<typeof createProviderForConfig>>;
  sandboxModel?: string;
  sandboxBaseUrl?: string;
}

async function getProviderForJob(llmConfigId?: string): Promise<LlmJobConfig> {
  // MOCK_LLM 模式（E2E）直接用 mock provider，不解密 seed key
  // （seed LlmConfig 用 dev LLM_ENCRYPTION_KEY 加密，与 E2E TEST_ENCRYPTION_KEY 不一致，
  //  解密会抛 "Unsupported state or unable to authenticate data" 导致 chat-turn job 失败）
  if (process.env.MOCK_LLM === "true") {
    return { providerFn: getFallbackProvider() };
  }

  const resolved = await resolveProviderConfig(prisma, {
    userId: "seed-user-ai-teacher",
    llmConfigId,
  });

  if (resolved.config) {
    const apiKey = decrypt(resolved.config.encryptedKey);
    return {
      providerFn: createProviderForConfig({
        provider: resolved.config.provider,
        apiKey,
        baseUrl: resolved.config.baseUrl ?? undefined,
      }),
      sandboxModel: resolved.config.defaultModel,
      sandboxBaseUrl: resolved.config.baseUrl ?? undefined,
    };
  }

  return { providerFn: getFallbackProvider() };
}

function buildToolsRecord(
  toolDefs: ToolDefinition[],
  ctx: ToolExecutionContext,
): Record<string, Tool> {
  const result: Record<string, Tool> = {};
  for (const def of toolDefs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[def.name] = aiTool({
      description: def.description,
      inputSchema: def.inputSchema as any,
      execute: async (params) => {
        return def.execute(params as Record<string, unknown>, ctx);
      },
    });
  }
  return result;
}

function collectPromptSection(toolDefs: ToolDefinition[]): string {
  const sections: string[] = [];
  for (const def of toolDefs) {
    if (def.promptSnippet) sections.push(def.promptSnippet);
    if (def.promptGuidelines && def.promptGuidelines.length > 0) {
      sections.push(def.promptGuidelines.map((g) => `- ${g}`).join("\n"));
    }
  }
  return sections.join("\n\n");
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
        const hasPayloadData =
          job.data.topic !== undefined && job.data.userId !== undefined;

        let topic: string;
        let teachingMode: string;
        let activeMode: string;
        let userId: string;
        let roadmapNodes: RoadmapNodePayload[];
        let userProfile: Parameters<typeof buildLearnerProfile>[0] = null;

        if (hasPayloadData) {
          topic = job.data.topic!;
          teachingMode = job.data.teachingMode ?? "warm";
          activeMode = job.data.activeMode ?? "learning";
          userId = job.data.userId!;
          roadmapNodes = job.data.roadmapNodes ?? [];

          const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
          });
          if (!user) throw new Error(`User ${userId} not found`);
          userProfile = user.profile;
        } else {
          console.log(
            `[chat-turn] job ${job.id} missing payload data, falling back to DB query`,
          );
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
          activeMode = session.activeMode;
          userId = session.userId;
          userProfile = session.user.profile;
          roadmapNodes = session.roadmap.nodes.map((n) => ({
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
          }));
        }

        const hasNodes = roadmapNodes.length > 0;

        const currentNode = hasNodes
          ? (roadmapNodes.find((node) => node.status === "in_progress") ??
            roadmapNodes.find((node) => node.status === "not_started") ??
            roadmapNodes.find((node) => node.status !== "mastered") ??
            roadmapNodes.at(-1))
          : null;

        const masteredNodes = hasNodes
          ? roadmapNodes
              .filter(
                (node) =>
                  node.status === "mastered" || node.masteryScore >= 80,
              )
              .map((node) => node.title)
          : [];

        const llmJobConfig = await getProviderForJob(job.data.llmConfigId);
        const providerFn = llmJobConfig.providerFn;

        const contextManager = new ContextManager({
          loadSummary: async (sid) => {
            const s = await prisma.session.findUnique({
              where: { id: sid },
              select: { summary: true },
            });
            if (!s?.summary) return null;
            const parsed = StructuredSummarySchema.safeParse(s.summary);
            return parsed.success ? parsed.data : null;
          },
          saveSummary: async (sid, summary) => {
            await prisma.session.update({
              where: { id: sid },
              data: { summary: JSON.parse(JSON.stringify(summary)) },
            });
          },
          model: providerFn("deepseek-v4-flash"),
        });

        const isDiagnosisPhase = hasNodes
          ? roadmapNodes.every((n) => n.status === "not_started")
          : true;

        // 迭代 051：按 session.activeMode 分流——review → 考官 prompt + 复习 tools；learning → 既有 tutor
        const isReviewMode = activeMode === "review";

        let systemPrompt: string;
        let allToolDefs: ToolDefinition[];

        if (isReviewMode) {
          const dueNodes = selectDueReviewNodes(roadmapNodes);
          systemPrompt = buildReviewSystemPrompt({
            topic,
            dueNodes: dueNodes.map((n) => ({
              id: n.id,
              index: n.index,
              title: n.title,
              description: n.description,
              memoryStrength: n.memoryStrength,
              isOverdue: n.isOverdue,
            })),
            learnerProfile: buildLearnerProfile(userProfile) || "首次学习",
          });
          allToolDefs = [...reviewToolDefinitions];
        } else {
          systemPrompt = buildTutorSystemPrompt({
            topic,
            currentNode: currentNode
              ? {
                  id: currentNode.id,
                  title: currentNode.title,
                  description: currentNode.description,
                }
              : { id: "pending", title: topic, description: "等待诊断后生成学习路线" },
            allNodes: hasNodes
              ? roadmapNodes.map((n) => ({
                  id: n.id,
                  index: n.index,
                  title: n.title,
                  status: n.status,
                }))
              : [],
            masteredNodes: masteredNodes.join(", ") || "无",
            learnerProfile: buildLearnerProfile(userProfile) || "首次学习",
            teachingMode: (teachingMode as "warm" | "strict") ?? "warm",
            isDiagnosisPhase,
            sandboxModel: llmJobConfig.sandboxModel,
            sandboxBaseUrl: llmJobConfig.sandboxBaseUrl,
          });
          const delegateTaskDef = createDelegateTaskTool(
            subagentConfigs,
            { get: (name: string) => allToolDefs.find((t) => t.name === name), getAll: () => allToolDefs },
            providerFn,
          );
          allToolDefs = [...tutorToolDefinitions, delegateTaskDef];
        }

        // Build tools
        const toolCtx: ToolExecutionContext = {
          prisma,
          sessionId,
          userId,
        };

        const toolPromptSection = collectPromptSection(allToolDefs);
        const fullSystemPrompt = toolPromptSection
          ? `${systemPrompt}\n\n# 工具使用说明\n\n${toolPromptSection}`
          : systemPrompt;

        // 迭代 009：学习模式下若用户有已就绪的学习资料，提示 Agent 可用 retrieveContext 检索
        let ragHint = "";
        if (!isReviewMode) {
          const readySourceCount = await prisma.source.count({
            where: { userId, status: "ready" },
          });
          ragHint =
            readySourceCount > 0
              ? `\n\n# 学习资料\n\n学习者已上传 ${readySourceCount} 份学习资料（已就绪可检索）。当问题涉及资料内容时，使用 retrieveContext 工具检索相关片段，基于资料内容教学。`
              : "";
        }
        const finalSystemPrompt = `${fullSystemPrompt}${ragHint}`;

        const tools = buildToolsRecord(allToolDefs, toolCtx);

        // Prepare context (compaction check)
        const prepared = await contextManager.prepareForStream(
          sessionId,
          messages.map((m) => ({ role: m.role, content: m.content })),
        );

        const modelName = llmJobConfig.sandboxModel ?? "deepseek-v4-flash";
        const model = providerFn(modelName);

        const loopResult = await runAgentLoop({
          model,
          system: finalSystemPrompt,
          messages: prepared.messages,
          tools,
          publisher,
          channel,
          maxSteps: 7,
          timeoutMs: STREAM_TIMEOUT_MS,
        });

        // Post-process: async compaction if needed
        if (prepared.needsCompaction) {
          contextManager
            .compactAfterStream(sessionId, prepared.messages)
            .catch((err) => {
              console.error("[chat-turn] async compaction failed:", err);
            });
        }

        await MessageService.persistTurn(
          sessionId,
          loopResult.assistantText,
          loopResult.toolResults,
        );

        await prisma.message.update({
          where: { id: messageId },
          data: { status: "completed" },
        });

        await publisher.publish(channel, JSON.stringify({ type: "done" }));

        console.log(
          `[chat-turn] completed job ${job.id} for session ${sessionId} (${loopResult.steps} steps, stop: ${loopResult.stopReason})`,
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
        const userMessage = errorMessage.includes("ModelMessage[] schema")
          ? "AI 服务内部错误，请重新发送消息"
          : errorMessage;
        await publisher.publish(
          channel,
          JSON.stringify({ type: "error", message: userMessage }),
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
