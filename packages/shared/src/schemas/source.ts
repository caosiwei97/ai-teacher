import { z } from 'zod';

// 学习资料类型（对应 Prisma SourceType enum）
export const SourceType = z.enum(["pdf", "markdown"]);

// 学习资料处理状态（对应 Prisma SourceStatus enum，迭代 009 RAG 异步流水线状态机）
export const SourceStatus = z.enum(["pending", "processing", "ready", "failed"]);

// 学习资料记录（API 响应体；createdAt 经 JSON 序列化为 ISO 字符串）
export const SourceRecord = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  type: SourceType,
  content: z.string().nullable(),
  fileUrl: z.string().nullable(),
  checksum: z.string().nullable(),
  status: SourceStatus,
  createdAt: z.string(),
});

export type SourceType = z.infer<typeof SourceType>;
export type SourceStatus = z.infer<typeof SourceStatus>;
export type SourceRecord = z.infer<typeof SourceRecord>;

// URL 导入请求体（POST /api/sources/url）
export const SourceUrlInput = z.object({
  userId: z.string().min(1),
  url: z.string().url(),
});

export type SourceUrlInput = z.infer<typeof SourceUrlInput>;
