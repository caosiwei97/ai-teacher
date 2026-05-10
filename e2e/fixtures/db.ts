import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:25432/ai_teacher" },
  },
});

export async function cleanTestSessions() {
  const testSessions = await prisma.session.findMany({
    where: { id: { not: { startsWith: "seed-" } } },
    select: { id: true },
  });

  if (testSessions.length === 0) return;

  const ids = testSessions.map((s) => s.id);

  await prisma.message.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.node.deleteMany({ where: { roadmap: { session: { id: { in: ids } } } } });
  await prisma.roadmap.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.session.deleteMany({ where: { id: { in: ids } } });
}
