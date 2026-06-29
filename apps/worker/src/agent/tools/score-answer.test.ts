import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockScoreAnswer } = vi.hoisted(() => ({
  mockScoreAnswer: vi.fn(),
}));

vi.mock("@ai-teacher/shared/services/interview-service", () => ({
  InterviewService: { scoreAnswer: mockScoreAnswer },
}));

import { scoreAnswerTool } from "./score-answer";

const ctx = { sessionId: "s1", userId: "u1", prisma: {} };

describe("scoreAnswer tool", () => {
  beforeEach(() => {
    mockScoreAnswer.mockReset();
  });

  it("调 InterviewService.scoreAnswer，返回 success + 新难度 + questionCount", async () => {
    mockScoreAnswer.mockResolvedValue({ difficulty: "hard", streak: 0, questionCount: 3 });

    const result = await scoreAnswerTool.execute(
      { question: "什么是闭包", answer: "函数+词法环境", score: 90, isCorrect: true, difficulty: "medium", feedback: "答对核心" },
      ctx,
    );

    expect(mockScoreAnswer).toHaveBeenCalledWith("s1", expect.objectContaining({ question: "什么是闭包", isCorrect: true, score: 90 }));
    expect(result).toMatchObject({ success: true, difficulty: "hard", questionCount: 3 });
  });

  it("答错：传 isCorrect=false，返回新难度（可能降档）", async () => {
    mockScoreAnswer.mockResolvedValue({ difficulty: "easy", streak: 0, questionCount: 2 });

    const result = await scoreAnswerTool.execute(
      { question: "q", answer: "a", score: 30, isCorrect: false, difficulty: "medium", feedback: "概念混淆" },
      ctx,
    );

    expect(mockScoreAnswer).toHaveBeenCalledWith("s1", expect.objectContaining({ isCorrect: false }));
    expect(result.difficulty).toBe("easy");
    expect(result.feedback).toBe("概念混淆");
  });

  it("scoreAnswer 抛错 → 不吞异常", async () => {
    mockScoreAnswer.mockRejectedValue(new Error("no interview"));
    await expect(
      scoreAnswerTool.execute({ question: "q", answer: "a", score: 50, isCorrect: false, difficulty: "easy", feedback: "" }, ctx),
    ).rejects.toThrow("no interview");
  });
});
