import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ai-teacher/db";
import { ProfileService } from "../../../../../../worker/src/agent/services/profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSessionSchema = z.object({
  status: z.enum(["active", "completed", "archived"]),
});

const sessionInclude = {
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: sessionInclude,
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existingSession = await prisma.session.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });

  if (!existingSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = await prisma.session.update({
    where: { id },
    data: {
      status: parsed.data.status,
    },
    include: sessionInclude,
  });

  if (
    parsed.data.status === "completed" &&
    existingSession.status !== "completed"
  ) {
    void updateProfileAfterCompletion(existingSession.userId, session);
  }

  return NextResponse.json({ session });
}

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const archivedSession = await prisma.session.update({
    where: { id },
    data: {
      status: "archived",
    },
    select: {
      id: true,
      status: true,
    },
  });

  return NextResponse.json({ success: true, session: archivedSession });
}
