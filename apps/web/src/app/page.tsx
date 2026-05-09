import { prisma } from "@ai-teacher/db";
import { WelcomeContent } from "./welcome-content";

const USER_ID = "seed-user-ai-teacher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let sessionCards: Array<{
    id: string;
    topic: string;
    status: string;
    progress: { totalNodes: number; masteredNodes: number };
  }> = [];

  try {
    const sessions = await prisma.session.findMany({
      where: { userId: USER_ID, status: { notIn: ["archived"] } },
      orderBy: { updatedAt: "desc" },
      include: { roadmap: { include: { nodes: { orderBy: { index: "asc" } } } } },
    });

    sessionCards = sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
      status: s.status,
      progress: {
        totalNodes: s.roadmap?.nodes.length ?? 0,
        masteredNodes:
          s.roadmap?.nodes.filter((n) => n.status === "mastered" || n.masteryScore >= 80).length ?? 0,
      },
    }));
  } catch {
    sessionCards = [];
  }

  return <WelcomeContent sessions={sessionCards} />;
}
