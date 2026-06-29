import { z } from "zod";

// 面试模式 API schemas（spec §4，迭代 052）

export const InterviewDifficultySchema = z.enum(["easy", "medium", "hard"]);
export type InterviewDifficulty = z.infer<typeof InterviewDifficultySchema>;

export const InterviewStatusSchema = z.enum(["in_progress", "completed"]);
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;

export const QuestionLogEntrySchema = z.object({
  question: z.string(),
  answer: z.string(),
  score: z.number(),
  isCorrect: z.boolean(),
  difficulty: InterviewDifficultySchema,
  feedback: z.string(),
});
export type QuestionLogEntry = z.infer<typeof QuestionLogEntrySchema>;

// GET /interview/result 响应（评分卡/复盘）
export const InterviewResultOutputSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  status: InterviewStatusSchema,
  difficulty: InterviewDifficultySchema,
  streak: z.number(),
  totalScore: z.number(),
  questionLog: z.array(QuestionLogEntrySchema).nullable(),
  weakPoints: z.array(z.string()).nullable(),
  improvement: z.string().nullable(),
  createdAt: z.date(),
});
export type InterviewResultOutput = z.infer<typeof InterviewResultOutputSchema>;
