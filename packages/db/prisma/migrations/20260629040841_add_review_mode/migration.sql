-- 迭代 051：复习模式数据层。ActiveMode enum（学/固/验三阶段）+ Session.activeMode + Node 间隔重复字段（memoryStrength/lastReviewedAt/nextReviewAt/reviewInterval）。@default 兜底老数据（spec §7.1）
-- 注：Prisma 误把 rag migration 用 raw SQL 创建的 HNSW 向量索引当 drift 想 DROP，已手动移除（已知 Prisma+pgvector 模式，同 20260626170000_add_video_source）

-- CreateEnum
CREATE TYPE "ActiveMode" AS ENUM ('learning', 'review', 'interview');

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "memoryStrength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "nextReviewAt" TIMESTAMP(3),
ADD COLUMN     "reviewInterval" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeMode" "ActiveMode" NOT NULL DEFAULT 'learning';
