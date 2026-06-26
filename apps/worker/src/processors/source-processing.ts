import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { Worker as BullWorker } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@ai-teacher/db";
import { chunkText } from "@ai-teacher/shared/services/text-chunk";
import { embedTexts } from "@ai-teacher/shared/services/embedding";
import { parsePdf, parseMarkdown, parseUrl } from "@ai-teacher/shared/services/document-parser";
import { getObject } from "@ai-teacher/shared/services/storage";
import { toVectorLiteral } from "@ai-teacher/shared/services/retrieval";

// 迭代 009：学习资料异步处理消费者。
// pending → processing → 解析/分块/embedding/入库 → ready（失败 → failed）

export interface SourceProcessingJobData {
  sourceId: string;
}

export function createSourceProcessingWorker(
  connection?: Redis,
): BullWorker<SourceProcessingJobData> {
  const REDIS_URL = process.env.REDIS_URL || "redis://localhost:26379";

  const worker = new BullWorker<SourceProcessingJobData>(
    "source-processing",
    async (job) => {
      const { sourceId } = job.data;
      console.log(`[source-processing] processing job ${job.id} for source ${sourceId}`);

      const source = await prisma.source.findUnique({ where: { id: sourceId } });
      if (!source) throw new Error(`source not found: ${sourceId}`);

      await prisma.source.update({
        where: { id: sourceId },
        data: { status: "processing" },
      });

      try {
        // 1. 解析为纯文本
        let text: string;
        let title = source.title;
        if (source.type === "pdf") {
          if (!source.fileUrl) throw new Error("pdf source missing fileUrl");
          text = await parsePdf(await getObject(source.fileUrl));
        } else if (source.fileUrl && source.fileUrl.startsWith("http")) {
          // URL 来源（type=markdown, fileUrl=http URL）
          const doc = await parseUrl(source.fileUrl);
          text = doc.text;
          title = doc.title;
        } else {
          // Markdown 上传：文本已存 content
          text = parseMarkdown(source.content ?? "");
        }

        // 2. 分块
        const chunks = chunkText(text);
        if (chunks.length === 0) throw new Error("解析后无有效文本");

        // 3. 批量 embedding
        const embeddings = await embedTexts(chunks.map((c) => c.content));

        // 4. 原子入库（先清旧 chunk 再插新，幂等支持重处理；embedding 是 vector 走 raw SQL）
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM "DocumentChunk" WHERE "sourceId" = ${sourceId}`,
          ...chunks.map((c, i) => {
            const id = randomUUID();
            const vec = toVectorLiteral(embeddings[i]);
            return prisma.$executeRaw(Prisma.sql`
              INSERT INTO "DocumentChunk" (id, "sourceId", "chunkIndex", content, "tokenCount", embedding, "createdAt")
              VALUES (${id}, ${sourceId}, ${c.index}, ${c.content}, ${c.tokenCount}, ${vec}::vector, NOW())
            `);
          }),
        ]);

        // 5. 状态就绪 + 回写 title/content
        await prisma.source.update({
          where: { id: sourceId },
          data: { status: "ready", title, content: text },
        });

        console.log(
          `[source-processing] source ${sourceId} ready — ${chunks.length} chunks embedded`,
        );
      } catch (err) {
        await prisma.source.update({
          where: { id: sourceId },
          data: { status: "failed" },
        });
        console.error(
          `[source-processing] source ${sourceId} failed: ${(err as Error).message}`,
        );
        throw err;
      }
    },
    {
      connection: connection ?? {
        host: new URL(REDIS_URL).hostname,
        port: Number(new URL(REDIS_URL).port),
      },
    },
  );

  return worker;
}
