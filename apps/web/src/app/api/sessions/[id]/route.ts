import { NextResponse } from "next/server";
import { prisma } from "@ai-teacher/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
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
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
