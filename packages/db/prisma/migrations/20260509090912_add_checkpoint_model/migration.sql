-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "graphNode" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checkpoint_sessionId_createdAt_idx" ON "Checkpoint"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
