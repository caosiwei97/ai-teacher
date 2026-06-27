-- 迭代 049 Phase 0：LlmConfig 加 source 字段，标记配置来源（user/env）
ALTER TABLE "LlmConfig" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'user';
