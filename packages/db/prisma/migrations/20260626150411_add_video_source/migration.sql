-- 迭代 009 Phase 2：视频理解。SourceType += video；Source += externalUrl（粘贴的原始视频链接）
-- 注：Prisma 误把 rag migration 用 raw SQL 创建的 HNSW 向量索引当 drift 想 DROP，已手动移除（已知 Prisma+pgvector 模式）

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "externalUrl" TEXT;
