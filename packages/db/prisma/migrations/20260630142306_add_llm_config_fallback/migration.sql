-- 迭代 054：LlmConfig 加 fallback 字段，主模型失败时降级
-- 注：Prisma 误把 rag migration 用 raw SQL 创建的 HNSW 向量索引当 drift 想 DROP，已手动移除（已知 Prisma+pgvector 模式，同 20260626170000_add_video_source / 20260629040841_add_review_mode）

-- AlterTable
ALTER TABLE "LlmConfig" ADD COLUMN     "fallbackLlmConfigId" TEXT,
ADD COLUMN     "fallbackModelId" TEXT;

-- AddForeignKey
ALTER TABLE "LlmConfig" ADD CONSTRAINT "LlmConfig_fallbackLlmConfigId_fkey" FOREIGN KEY ("fallbackLlmConfigId") REFERENCES "LlmConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
