-- 迭代 052：面试模式数据层。InterviewStatus/InterviewDifficulty enum + InterviewResult model（评分+难度状态+薄弱点+改进建议，spec §4/§7）
-- 注：Prisma 误把 rag migration 用 raw SQL 创建的 HNSW 向量索引当 drift 想 DROP，已手动移除（已知 Prisma+pgvector 模式，同 add_video_source/add_review_mode）

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('in_progress', 'completed');

-- CreateEnum
CREATE TYPE "InterviewDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateTable
CREATE TABLE "InterviewResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'in_progress',
    "difficulty" "InterviewDifficulty" NOT NULL DEFAULT 'medium',
    "streak" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "questionLog" JSONB,
    "weakPoints" JSONB,
    "improvement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewResult_sessionId_idx" ON "InterviewResult"("sessionId");

-- AddForeignKey
ALTER TABLE "InterviewResult" ADD CONSTRAINT "InterviewResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
