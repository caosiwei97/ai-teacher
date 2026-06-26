import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@ai-teacher/db";
import {
  generateDiagnosticQuestions,
  evaluateDiagnosticAnswers,
} from "../../../worker/src/agent/diagnostic";

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

export const diagnosticRoute = new Hono()
  .post("/", async (c) => {
    const sessionId = c.req.param("sessionId");

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
      return c.json({ error: "Session not found" }, 404);
    }

    if (!session.roadmap || session.roadmap.nodes.length === 0) {
      return c.json({ error: "Session roadmap not found" }, 409);
    }

    const nodes = session.roadmap.nodes.map((n) => ({
      index: n.index,
      title: n.title,
      description: n.description,
    }));

    try {
      const diagnostic = await generateDiagnosticQuestions(session.topic, nodes);

      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "diagnosing" },
      });

      return c.json({ questions: diagnostic.questions });
    } catch (error) {
      console.error("[diagnostic] failed to generate questions", error);
      return c.json({ error: "Failed to generate diagnostic questions" }, 500);
    }
  })
  .post("/evaluate", zValidator("json", evaluateSchema), async (c) => {
    const sessionId = c.req.param("sessionId");
    const { questions, answers } = c.req.valid("json");

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
      return c.json({ error: "Session not found" }, 404);
    }

    if (!session.roadmap || session.roadmap.nodes.length === 0) {
      return c.json({ error: "Session roadmap not found" }, 409);
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
        return c.json({ error: "Invalid starting node index" }, 500);
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
              data: { status: "in_progress" },
            });
          }
        }

        await tx.session.update({
          where: { id: sessionId },
          data: { status: "active" },
        });
      });

      return c.json({
        evaluation,
        startingNode: {
          id: startingNode.id,
          index: startingNode.index,
          title: startingNode.title,
        },
      });
    } catch (error) {
      console.error("[diagnostic] failed to evaluate answers", error);
      return c.json({ error: "Failed to evaluate diagnostic answers" }, 500);
    }
  });
