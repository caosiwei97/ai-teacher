import { z } from 'zod';

// 学习资料类型（对应 Prisma SourceType enum）
export const SourceType = z.enum(["pdf", "markdown"]);

export type SourceType = z.infer<typeof SourceType>;
