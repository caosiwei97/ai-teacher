import { z } from "zod";

export const StructuredSummarySchema = z.object({
  completedTopics: z.array(z.string()).describe("已完成的知识点列表"),
  masteryState: z.record(
    z.string(),
    z.object({
      level: z.enum(["mastered", "in-progress", "not-started"]),
      lastAssessed: z.string(),
    }),
  ).describe("各节点掌握状态"),
  misconceptions: z.array(z.string()).describe("学习者的常见误解"),
  learningPreferences: z.object({
    preferredExplanationStyle: z.string(),
    pacePreference: z.enum(["fast", "moderate", "slow"]),
  }).describe("学习偏好"),
  keyDecisions: z.array(z.string()).describe("对话中的关键教学决策"),
});

export type StructuredSummary = z.infer<typeof StructuredSummarySchema>;
