import { prisma } from "@ai-teacher/db";
import { HomeDashboard } from "./home-dashboard";

const USER_ID = "seed-user-ai-teacher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessions = await prisma.session.findMany({
    where: {
      userId: USER_ID,
      status: { notIn: ["archived"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      topic: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      roadmap: {
        select: {
          nodes: {
            select: {
              id: true,
              status: true,
              masteryScore: true,
            },
          },
        },
      },
    },
  });

  const mappedSessions = sessions.map((s) => {
    const nodes = s.roadmap?.nodes ?? [];
    const totalNodes = nodes.length;
    const masteredNodes = nodes.filter((n) => n.status === "mastered").length;
    return {
      id: s.id,
      topic: s.topic,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      progress: { totalNodes, masteredNodes },
    };
  });

  return <HomeDashboard sessions={mappedSessions} />;
}
