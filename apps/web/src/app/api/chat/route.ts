import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ai-teacher/db";
import { TutorAgent } from "../../../../../worker/src/agent/tutor";
import { MessageService } from "../../../../../worker/src/agent/services/message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
});

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

const STREAM_TIMEOUT_MS = 120_000;

async function persistMessages(
  sessionId: string,
  userMessage: string,
  result: Awaited<ReturnType<TutorAgent["run"]>>,
) {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Stream timeout")), STREAM_TIMEOUT_MS),
    );

    const [assistantText, toolResults] = await Promise.race([
      Promise.all([result.text, result.toolResults]),
      timeoutPromise,
    ]);

    const mapped = toolResults.map((tr) => ({
      toolName: tr.toolName,
      result: tr.result,
    }));

    await MessageService.persistTurn(sessionId, userMessage, assistantText, mapped);
  } catch (error) {
    console.error("[chat] failed to persist messages", error);
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

  const agent = new TutorAgent();
  const result = await agent.run({
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
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  void persistMessages(sessionId, message, result);

  return result.toDataStreamResponse();
}
