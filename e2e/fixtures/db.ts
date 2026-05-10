import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";

const prisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
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
