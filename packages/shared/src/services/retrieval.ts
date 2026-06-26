import { prisma } from "@ai-teacher/db";
import { Prisma } from "@prisma/client";

// 迭代 009：pgvector 相似度检索（raw SQL，Prisma 不原生支持 vector 类型）。
// 按 userId 过滤（安全边界：只能检索用户自己的资料库），cosine 距离排序取 top-k。

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  sourceId: string;
  sourceTitle: string;
  /** cosine 距离，越小越相关（0 = 完全相同，2 = 完全相反） */
  score: number;
}

/** 数值向量 → pgvector 文本字面量 `[1,2,3]`（纯函数，便于测试） */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function retrieveChunks(
  queryEmbedding: number[],
  userId: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const vec = toVectorLiteral(queryEmbedding);
  return prisma.$queryRaw<RetrievedChunk[]>(Prisma.sql`
    SELECT
      dc.id,
      dc.content,
      dc."chunkIndex",
      dc."tokenCount",
      dc."sourceId",
      s.title AS "sourceTitle",
      (dc.embedding <=> ${vec}::vector) AS score
    FROM "DocumentChunk" dc
    JOIN "Source" s ON s.id = dc."sourceId"
    WHERE s."userId" = ${userId}
    ORDER BY dc.embedding <=> ${vec}::vector
    LIMIT ${topK}
  `);
}
