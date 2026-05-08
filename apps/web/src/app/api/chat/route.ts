import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ai-teacher/db";
import { streamTutorResponse } from "../../../../../worker/src/agent/tutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
});

type AssessmentPayload = {
  success: boolean;
  conceptId: string;
  summary: string;
  reviewTable: Array<{
    points: string;
    yourAnswer: string;
    accuracy: string;
  }>;
  coreTags: string[];
  nextNodeTitle: string;
};

type MasteryPayload = {
  success: boolean;
  conceptId: string;
  score: number;
  strengths: string[];
  gaps: string[];
  misconceptions: Array<{
    belief: string;
    rootCause: string;
    resolved: boolean;
  }>;
};

type AdvancePayload = {
  currentNodeId: string;
  nextNodeId: string;
  masteryScore: number;
};

function formatProfileValue(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function buildLearnerProfile(profile: {
  learningStyle: unknown;
  strengths: unknown;
  weaknesses: unknown;
  misconceptionPatterns: unknown;
  sessionsSummary: unknown;
} | null) {
  if (!profile) {
    return "首次学习";
  }

  const sections = [
    profile.learningStyle
      ? `学习偏好：${formatProfileValue(profile.learningStyle)}`
      : null,
    profile.strengths ? `已有优势：${formatProfileValue(profile.strengths)}` : null,
    profile.weaknesses ? `薄弱点：${formatProfileValue(profile.weaknesses)}` : null,
    profile.misconceptionPatterns
      ? `常见误解：${formatProfileValue(profile.misconceptionPatterns)}`
      : null,
    profile.sessionsSummary
      ? `历史学习摘要：${formatProfileValue(profile.sessionsSummary)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n") || "首次学习";
}

async function persistChatTurn(
  sessionId: string,
  userMessage: string,
  result: Awaited<ReturnType<typeof streamTutorResponse>>,
) {
  try {
    const [assistantText, toolResults] = await Promise.all([
      result.text,
      result.toolResults,
    ]);

    const assistantMetadata =
      toolResults.length > 0
        ? {
            toolResults: toolResults.map((toolResult) => ({
              toolName: toolResult.toolName,
              result: toolResult.result,
            })),
          }
        : undefined;

    let assessmentPayload: AssessmentPayload | null = null;
    let masteryPayload: MasteryPayload | null = null;
    let advancePayload: AdvancePayload | null = null;

    for (const toolResult of toolResults) {
      if (toolResult.toolName === "generateAssessment") {
        assessmentPayload = toolResult.result;
      }

      if (toolResult.toolName === "assessMastery") {
        masteryPayload = toolResult.result;
      }

      if (toolResult.toolName === "advanceNode") {
        advancePayload = {
          currentNodeId: toolResult.result.currentNodeId,
          nextNodeId: toolResult.result.nextNodeId,
          masteryScore: toolResult.result.masteryScore,
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          sessionId,
          role: "learner",
          type: "text",
          content: userMessage,
        },
      });

      await tx.message.create({
        data: {
          sessionId,
          role: "tutor",
          type: assessmentPayload ? "assessment" : "text",
          content: assistantText,
          metadata: assistantMetadata,
        },
      });

      if (masteryPayload) {
        await tx.node.update({
          where: { id: masteryPayload.conceptId },
          data: {
            masteryScore: masteryPayload.score,
            reviewLog: masteryPayload,
            status: masteryPayload.score >= 80 ? "mastered" : "in-progress",
            masteredAt: masteryPayload.score >= 80 ? new Date() : null,
          },
        });
      }

      if (advancePayload) {
        await tx.node.update({
          where: { id: advancePayload.currentNodeId },
          data: {
            status: "mastered",
            masteryScore: advancePayload.masteryScore,
            masteredAt: new Date(),
          },
        });

        await tx.node.update({
          where: { id: advancePayload.nextNodeId },
          data: {
            status: "in-progress",
          },
        });
      }
    });
  } catch (error) {
    console.error("[chat] failed to persist streamed messages", error);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, messages } = parsed.data;
  const message = messages[messages.length - 1].content;

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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.roadmap || session.roadmap.nodes.length === 0) {
    return NextResponse.json(
      { error: "Session roadmap not found" },
      { status: 409 },
    );
  }

  const currentNode =
    session.roadmap.nodes.find((node) => node.status !== "mastered") ??
    session.roadmap.nodes.at(-1);

  if (!currentNode) {
    return NextResponse.json(
      { error: "Current node not found" },
      { status: 409 },
    );
  }

  const masteredNodes = session.roadmap.nodes
    .filter((node) => node.status === "mastered" || node.masteryScore >= 80)
    .map((node) => node.title);

  const result = await streamTutorResponse({
    topic: session.topic,
    currentNode: {
      id: currentNode.id,
      title: currentNode.title,
      description: currentNode.description,
    },
    masteredNodes,
    learnerProfile: buildLearnerProfile(session.user.profile),
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  void persistChatTurn(sessionId, message, result);

  return result.toDataStreamResponse();
}
