import type { ToolDefinition } from "../types";
import { z } from "zod";
import { InterviewService } from "@ai-teacher/shared/services/interview-service";

// 面试模式：每题即时评分，更新难度/streak（spec §4.1）。考官每答完一题调用。
export const scoreAnswerTool: ToolDefinition = {
  name: "scoreAnswer",
  description:
    "面试每题即时评分，按答题表现动态调整难度（连续2答对升档/连续2答错降档）。候选人答完一题后调用",
  inputSchema: z.object({
    question: z.string().describe("本题题目"),
    answer: z.string().describe("候选人回答摘要"),
    score: z.number().min(0).max(100).describe("本题评分 0-100"),
    isCorrect: z.boolean().describe("是否答对核心"),
    difficulty: z.enum(["easy", "medium", "hard"]).describe("本题难度"),
    feedback: z.string().describe("薄弱点/评语，1 句"),
  }),
  execute: async (params, ctx) => {
    const p = params as {
      question: string;
      answer: string;
      score: number;
      isCorrect: boolean;
      difficulty: "easy" | "medium" | "hard";
      feedback: string;
    };
    const result = await InterviewService.scoreAnswer(ctx.sessionId, p);
    return { success: true, ...p, ...result };
  },
  promptSnippet: `**scoreAnswer 工具**：候选人每答完一题必须调用。传入 question/answer/score(0-100)/isCorrect/difficulty(本题难度)/feedback(薄弱点)。系统按连续表现动态调整难度（连续2答对升档/连续2答错降档），返回新 difficulty + streak + questionCount。你据新 difficulty 出下一题。评分内部记录，不要告诉候选人单题分数。`,
  promptGuidelines: [
    "候选人答完一题立即调用，不要攒着",
    "评分严格客观，isCorrect 仅当答对核心才算 true",
    "feedback 简短标注薄弱点（复盘用）",
    "不要把单题分数或总评告诉候选人——只追问或出下一题",
  ],
};
