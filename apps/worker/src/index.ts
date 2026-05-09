import "dotenv/config";
import Redis from "ioredis";
import { Queue } from "bullmq";
import { createServer } from "http";
import { prisma } from "@ai-teacher/db";
import { createChatTurnWorker } from "./processors/chat-turn";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";
const QUEUE_NAME = "chat-turn";
const WORKER_PORT = Number(process.env.WORKER_PORT || 38423);

async function recoverOrphanedJobs() {
  const orphans = await prisma.message.findMany({
    where: { status: "processing" },
  });

  if (orphans.length === 0) {
    console.log("[worker] no orphaned jobs to recover");
    return;
  }

  console.log(`[worker] recovering ${orphans.length} orphaned job(s)`);

  for (const msg of orphans) {
    await prisma.message.update({
      where: { id: msg.id },
      data: { status: "failed" },
    });
  }

  console.log(
    `[worker] marked ${orphans.length} orphaned message(s) as failed`,
  );
}

async function main() {
  console.log("[worker] starting...");

  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });

  await recoverOrphanedJobs();

  const chatWorker = createChatTurnWorker(connection);

  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "failed",
  );
  console.log(
    `[worker] queue "${QUEUE_NAME}" — waiting: ${counts.waiting}, active: ${counts.active}, failed: ${counts.failed}`,
  );

  console.log(`[worker] ready — consuming "${QUEUE_NAME}" queue`);

  createServer((_, res) => {
    res.writeHead(200);
    res.end("ok");
  }).listen(WORKER_PORT, () => {
    console.log(`[worker] health check on http://localhost:${WORKER_PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down...`);
    await chatWorker.close();
    await queue.close();
    connection.quit();
    await prisma.$disconnect();
    console.log("[worker] shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
