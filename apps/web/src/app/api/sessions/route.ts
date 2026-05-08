import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ai-teacher/db";
import { generateRoadmap } from "../../../../../worker/src/agent/roadmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSessionSchema = z.object({
  userId: z.string().min(1),
  topic: z.string().min(1),
  sourceId: z.string().min(1).optional(),
});

function buildFallbackNodes(topic: string) {
  return [
    {
      index: 0,
      title: `${topic} 的整体框架`,
      description: `先建立 ${topic} 的整体地图，知道这个主题在解决什么问题。`,
      status: "in-progress",
    },
    {
      index: 1,
      title: `${topic} 的核心概念`,
      description: `拆开 ${topic} 的关键术语和基础概念，避免后面混淆。`,
      status: "not-started",
    },
    {
      index: 2,
      title: `${topic} 的关键机制`,
      description: `理解 ${topic} 背后的运行逻辑、因果关系和判断依据。`,
      status: "not-started",
    },
    {
      index: 3,
      title: `${topic} 的常见误区`,
      description: `聚焦 ${topic} 里最容易踩坑或想偏的地方。`,
      status: "not-started",
    },
    {
      index: 4,
      title: `${topic} 的综合应用`,
      description: `把前面的知识串起来，能够用 ${topic} 解决完整问题。`,
      status: "not-started",
    },
  ];
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { userId, topic, sourceId } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (sourceId) {
    const source = await prisma.source.findFirst({
      where: { id: sourceId, userId },
      select: { id: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found for user" },
        { status: 404 },
      );
    }
  }

  let sourceContent: string | undefined;
  if (sourceId) {
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { content: true },
    });
    sourceContent = source?.content ?? undefined;
  }

  let nodeData: Array<{ index: number; title: string; description: string; status: string }>;
  try {
    const roadmap = await generateRoadmap(topic, sourceContent);
    nodeData = roadmap.nodes.map((node) => ({
      index: node.index,
      title: node.title,
      description: node.description,
      status: node.index === 0 ? "in-progress" : "not-started",
    }));
  } catch {
    nodeData = buildFallbackNodes(topic);
  }

  const session = await prisma.session.create({
    data: {
      userId,
      topic,
      sourceId,
      roadmap: {
        create: {
          nodes: {
            create: nodeData,
          },
        },
      },
    },
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

  return NextResponse.json({ session }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = z
    .object({
      userId: z.string().min(1),
    })
    .safeParse({
      userId: searchParams.get("userId") ?? "",
    });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "userId is required", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const sessions = await prisma.session.findMany({
    where: { userId: parsed.data.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      source: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
      roadmap: {
        include: {
          nodes: {
            orderBy: { index: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((session) => {
      const nodes = session.roadmap?.nodes ?? [];
      const currentNode =
        nodes.find((node) => node.status !== "mastered") ?? nodes.at(-1) ?? null;
      const masteredNodes = nodes.filter(
        (node) => node.status === "mastered" || node.masteryScore >= 80,
      ).length;

      return {
        id: session.id,
        userId: session.userId,
        topic: session.topic,
        sourceId: session.sourceId,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        source: session.source,
        progress: {
          totalNodes: nodes.length,
          masteredNodes,
          currentNodeId: currentNode?.id ?? null,
          currentNodeTitle: currentNode?.title ?? null,
        },
      };
    }),
  });
}
