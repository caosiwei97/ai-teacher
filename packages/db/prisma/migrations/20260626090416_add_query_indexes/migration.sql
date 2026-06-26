-- CreateIndex
CREATE INDEX "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Node_roadmapId_index_idx" ON "Node"("roadmapId", "index");

-- CreateIndex
CREATE INDEX "Node_roadmapId_status_idx" ON "Node"("roadmapId", "status");

-- CreateIndex
CREATE INDEX "Session_userId_status_idx" ON "Session"("userId", "status");

-- CreateIndex
CREATE INDEX "Session_userId_updatedAt_idx" ON "Session"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Source_userId_idx" ON "Source"("userId");
