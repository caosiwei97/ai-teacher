// 面试模式数据服务（spec §4）：启动/评分/复盘/查询。
// 算法源用 interview-scoring 纯函数；本服务封装 prisma 读写。
// server（面试 API）与 worker（scoreAnswer/finalizeInterview tool）共用。

import { prisma } from "@ai-teacher/db";
import {
  adjustDifficulty,
  computeTotalScore,
  type Difficulty,
} from "./interview-scoring";

export interface QuestionLogEntry {
  question: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  difficulty: Difficulty;
  feedback: string;
}

export interface ScoreAnswerInput {
  question: string;
  answer: string;
  score: number;
  isCorrect: boolean;
  difficulty: Difficulty;
  feedback: string;
}

export interface FinalizeInput {
  improvement: string;
  weakPoints: string[];
}

export interface ScoreAnswerResult {
  difficulty: Difficulty;
  streak: number;
  questionCount: number;
}

export interface FinalizeResult {
  totalScore: number;
  weakPoints: string[];
  improvement: string;
  questionCount: number;
}

const clone = (v: unknown) => JSON.parse(JSON.stringify(v));

export const InterviewService = {
  /** 取/建 in_progress 面试记录（设定阶段，幂等）。chat-turn 每轮调用注入 prompt */
  async startOrGet(sessionId: string, difficulty: Difficulty = "medium") {
    const existing = await prisma.interviewResult.findFirst({
      where: { sessionId, status: "in_progress" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return prisma.interviewResult.create({
      data: { sessionId, status: "in_progress", difficulty, streak: 0, totalScore: 0 },
    });
  },

  /** 每题即时评分：append questionLog + adjustDifficulty 更新难度/streak（spec §4.1） */
  async scoreAnswer(sessionId: string, input: ScoreAnswerInput): Promise<ScoreAnswerResult> {
    const interview = await prisma.interviewResult.findFirst({
      where: { sessionId, status: "in_progress" },
      orderBy: { createdAt: "desc" },
    });
    if (!interview) throw new Error(`No in-progress interview for session ${sessionId}`);

    const log = (interview.questionLog as QuestionLogEntry[] | null) ?? [];
    const newLog = [...log, { ...input }];
    const { difficulty: newDifficulty, streak: newStreak } = adjustDifficulty(
      interview.difficulty as Difficulty,
      interview.streak,
      input.isCorrect,
    );

    await prisma.interviewResult.update({
      where: { id: interview.id },
      data: {
        questionLog: clone(newLog),
        difficulty: newDifficulty,
        streak: newStreak,
      },
    });

    return { difficulty: newDifficulty, streak: newStreak, questionCount: newLog.length };
  },

  /** 复盘：computeTotalScore + 薄弱点 + 改进建议，置 completed（spec §4.1 复盘） */
  async finalize(sessionId: string, input: FinalizeInput): Promise<FinalizeResult> {
    const interview = await prisma.interviewResult.findFirst({
      where: { sessionId, status: "in_progress" },
      orderBy: { createdAt: "desc" },
    });
    if (!interview) throw new Error(`No in-progress interview for session ${sessionId}`);

    const log = (interview.questionLog as QuestionLogEntry[] | null) ?? [];
    const totalScore = computeTotalScore(log.map((q) => q.score));

    await prisma.interviewResult.update({
      where: { id: interview.id },
      data: {
        totalScore,
        weakPoints: clone(input.weakPoints),
        improvement: input.improvement,
        status: "completed",
      },
    });

    return {
      totalScore,
      weakPoints: input.weakPoints,
      improvement: input.improvement,
      questionCount: log.length,
    };
  },

  /** 查询最新面试结果（评分卡/复盘，③ UI 用） */
  async getResult(sessionId: string) {
    const interview = await prisma.interviewResult.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });
    return interview ?? null;
  },
};
