import { NextResponse } from "next/server";
import { prisma } from "@ai-teacher/db";
import { generateDiagnosticQuestions } from "../../../../../../../worker/src/agent/diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      roadmap: {
        include: {
          nodes: {
            orderBy: { index: "asc" },
          },
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

  const nodes = session.roadmap.nodes.map((n) => ({
    index: n.index,
    title: n.title,
    description: n.description,
  }));

  try {
    const diagnostic = await generateDiagnosticQuestions(
      session.topic,
      nodes,
    );

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "diagnosing" },
    });

    return NextResponse.json({ questions: diagnostic.questions });
  } catch (error) {
    console.error("[diagnostic] failed to generate questions", error);
    return NextResponse.json(
      { error: "Failed to generate diagnostic questions" },
      { status: 500 },
    );
  }
}
