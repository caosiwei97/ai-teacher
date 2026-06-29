import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher_test";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:25432/ai_teacher";

async function resetTestDb(prisma: PrismaClient) {
  // 删除顺序遵从外键依赖：先删子（session 的附属 + session 本身）再删父（source/llmConfig/user）
  // session 引用 source + llmConfig + user，故 session 须在 source/llmConfig 之前删
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

// 幂等建库：不 drop。drop 会击穿持续运行的 dev server（tsx watch）的 prisma 单例连接池，
// 导致后续请求 500（E2E 时序竞态根因，main 分支上也复现）。
// schema 漂移由下面的 migrate deploy 增量应用 + assertNoDrift 护栏兜底。
async function ensureTestDb(defaultPrisma: PrismaClient) {
  const exists = await defaultPrisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint as count FROM pg_database WHERE datname = 'ai_teacher_test'`,
  );
  if (Number(exists[0].count) === 0) {
    await defaultPrisma.$executeRawUnsafe(
      `CREATE DATABASE ai_teacher_test`,
    );
  }
}

// drift 护栏：校验 _prisma_migrations 表记录数 == 迁移目录数。
// 不一致直接 fail-fast，避免「漂移的旧测试库静默跳过新迁移」（drop+recreate 当初要解决的 bug）复发。
// 出错时提示开发者手动 drop 一次重建。
async function assertNoDrift(testPrisma: PrismaClient) {
  const migrationsDir = path.join(
    process.cwd(),
    "packages/db/prisma/migrations",
  );
  const migrationDirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => {
      const p = path.join(migrationsDir, d);
      return !d.startsWith(".") && fs.statSync(p).isDirectory();
    });
  const applied = await testPrisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*)::bigint as count FROM "_prisma_migrations"`,
  );
  const appliedCount = Number(applied[0].count);
  if (appliedCount !== migrationDirs.length) {
    throw new Error(
      `[E2E drift] 迁移不一致：目录有 ${migrationDirs.length} 个，_prisma_migrations 表记录 ${appliedCount} 个。` +
        `测试库可能 schema 漂移。请手动重建：psql 执行 DROP DATABASE ai_teacher_test 后重跑 E2E。`,
    );
  }
}

export default async function globalSetup() {
  const defaultPrisma = new PrismaClient({
    datasources: { db: { url: DEFAULT_DATABASE_URL } },
  });
  await ensureTestDb(defaultPrisma);
  await defaultPrisma.$disconnect();

  execSync(
    `DATABASE_URL=${TEST_DATABASE_URL} npx prisma migrate deploy --schema packages/db/prisma/schema.prisma`,
    { stdio: "pipe" },
  );

  const testPrisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
  });
  await assertNoDrift(testPrisma);
  await resetTestDb(testPrisma);
  await testPrisma.$disconnect();

  execSync(
    `DATABASE_URL=${TEST_DATABASE_URL} npx tsx packages/db/prisma/seed.ts`,
    { stdio: "inherit" },
  );
}
