import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher";

async function resetTestDb(prisma: PrismaClient) {
  await prisma.checkpoint.deleteMany();
  await prisma.message.deleteMany();
  await prisma.node.deleteMany();
  await prisma.roadmap.deleteMany();
  await prisma.learnerProfile.deleteMany();
  await prisma.llmConfig.deleteMany();
  await prisma.session.deleteMany();
  await prisma.source.deleteMany();
  await prisma.user.deleteMany();
}

// 每次重建测试库，从零 migrate deploy，杜绝迁移历史与 schema 脱节（drift）
// 修复迭代 048 E2E 暴露的 bug：原"仅当不存在才创建"导致测试库 schema 过时时
// migrate deploy 静默跳过新迁移（如 enum 迁移），worker 启动即崩
async function recreateTestDb(defaultPrisma: PrismaClient) {
  // 先断开测试库所有连接（drop database 要求无活跃连接）
  await defaultPrisma.$executeRawUnsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ai_teacher_test' AND pid <> pg_backend_pid()`,
  );
  await defaultPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS ai_teacher_test`);
  await defaultPrisma.$executeRawUnsafe(`CREATE DATABASE ai_teacher_test`);
}

export default async function globalSetup() {
  const defaultPrisma = new PrismaClient({
    datasources: { db: { url: DEFAULT_DATABASE_URL } },
  });
  await recreateTestDb(defaultPrisma);
  await defaultPrisma.$disconnect();

  execSync(
    `DATABASE_URL=${TEST_DATABASE_URL} npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`,
    { stdio: "pipe" },
  );

  const testPrisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
  await resetTestDb(testPrisma);
  await testPrisma.$disconnect();

  execSync(
    `DATABASE_URL=${TEST_DATABASE_URL} npx tsx packages/db/prisma/seed.ts`,
    { stdio: "inherit" },
  );
}
