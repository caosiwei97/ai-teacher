import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";

async function resetTestDb(prisma: PrismaClient) {
  // 删除顺序遵从外键依赖：session 引用 source + llmConfig + user，须先删 session
  await prisma.checkpoint.deleteMany();
  await prisma.message.deleteMany();
  await prisma.node.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.roadmap.deleteMany();
  await prisma.interviewResult.deleteMany();
  await prisma.session.deleteMany();
  await prisma.source.deleteMany();
  await prisma.llmConfig.deleteMany();
  await prisma.learnerProfile.deleteMany();
  await prisma.user.deleteMany();
}

export default async function globalTeardown() {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
  await resetTestDb(prisma);
  await prisma.$disconnect();
}
