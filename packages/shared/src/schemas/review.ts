import { z } from "zod";

// 复习模式 API schemas（spec §3，迭代 051）

// GET /review/due 返回的到期复习项
export const ReviewDueItemSchema = z.object({
  id: z.string(),
  index: z.number().int(),
  title: z.string(),
  description: z.string(),
  memoryStrength: z.number(),
  lastReviewedAt: z.date().nullable(),
  nextReviewAt: z.date().nullable(),
  reviewInterval: z.number().int(),
  isOverdue: z.boolean(),
});
export type ReviewDueItem = z.infer<typeof ReviewDueItemSchema>;

// POST /review/result 请求体
export const SubmitReviewResultInputSchema = z.object({
  nodeId: z.string().min(1),
  correct: z.boolean(),
});
export type SubmitReviewResultInput = z.infer<typeof SubmitReviewResultInputSchema>;

// POST /review/result 响应
export const ReviewResultOutputSchema = z.object({
  nodeId: z.string(),
  title: z.string(),
  memoryStrength: z.number(),
  lastReviewedAt: z.date(),
  nextReviewAt: z.date(),
  reviewInterval: z.number().int(),
  trend: z.enum(["强化", "维持", "衰退"]),
});
export type ReviewResultOutput = z.infer<typeof ReviewResultOutputSchema>;

// GET /review/summary 薄弱点项
export const ReviewWeakNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  memoryStrength: z.number(),
  reviewInterval: z.number().int(),
  lastReviewedAt: z.date().nullable(),
});
export type ReviewWeakNode = z.infer<typeof ReviewWeakNodeSchema>;

export const ReviewSummarySchema = z.object({
  totalMastered: z.number().int(),
  weakNodes: z.array(ReviewWeakNodeSchema),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
