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
  await prisma.session.deleteMany();
  await prisma.source.deleteMany();
  await prisma.user.deleteMany();
}

export default async function globalSetup() {
  const defaultPrisma = new PrismaClient({
    datasources: { db: { url: DEFAULT_DATABASE_URL } },
  });
  await defaultPrisma.$executeRawUnsafe(
    `SELECT 'CREATE DATABASE ai_teacher_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_teacher_test')`,
  );
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
