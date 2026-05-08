import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ai-teacher/db";
import { evaluateDiagnosticAnswers } from "../../../../../../../../worker/src/agent/diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const evaluateSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      type: z.string(),
      correctAnswer: z.string(),
      nodeIndex: z.number(),
    }),
  ),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    }),
  ),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const body = await request.json();
  const parsed = evaluateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { questions, answers } = parsed.data;

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
    const evaluation = await evaluateDiagnosticAnswers(
      session.topic,
      nodes,
      questions,
      answers,
    );

    const startingNodeIndex = evaluation.startingNodeIndex;
    const startingNode = session.roadmap.nodes[startingNodeIndex];

    if (!startingNode) {
      return NextResponse.json(
        { error: "Invalid starting node index" },
        { status: 500 },
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const node of session.roadmap!.nodes) {
        if (node.index < startingNodeIndex) {
          await tx.node.update({
            where: { id: node.id },
            data: {
              status: "mastered",
              masteryScore: 100,
              masteredAt: new Date(),
            },
          });
        } else if (node.index === startingNodeIndex) {
          await tx.node.update({
            where: { id: node.id },
            data: { status: "in-progress" },
          });
        }
      }

      await tx.session.update({
        where: { id: sessionId },
        data: { status: "active" },
      });
    });

    return NextResponse.json({
      evaluation,
      startingNode: {
        id: startingNode.id,
        index: startingNode.index,
        title: startingNode.title,
      },
    });
  } catch (error) {
    console.error("[diagnostic] failed to evaluate answers", error);
    return NextResponse.json(
      { error: "Failed to evaluate diagnostic answers" },
      { status: 500 },
    );
  }
}
