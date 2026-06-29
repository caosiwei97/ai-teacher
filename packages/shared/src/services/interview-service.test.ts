import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockFindFirst, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@ai-teacher/db", () => ({
  prisma: {
    interviewResult: { findFirst: mockFindFirst, create: mockCreate, update: mockUpdate },
  },
}));

import { InterviewService } from "./interview-service";

describe("InterviewService", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  describe("startOrGet", () => {
    it("有 in_progress → 直接返回（幂等）", async () => {
      mockFindFirst.mockResolvedValue({ id: "ir1", sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 0, questionLog: [] });
      const r = await InterviewService.startOrGet("s1");
      expect(r.id).toBe("ir1");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("无 in_progress → 创建（default medium）", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "ir2", sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 0, questionLog: [] });
      const r = await InterviewService.startOrGet("s1");
      expect(mockCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 0 }) });
      expect(r.id).toBe("ir2");
    });
  });

  describe("scoreAnswer", () => {
    it("append questionLog + adjustDifficulty 更新难度/streak，返回新难度", async () => {
      // medium, streak=1, 答对 → 升 hard, streak 0
      mockFindFirst.mockResolvedValue({ id: "ir1", sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 1, questionLog: [{ question: "q1", score: 80 }] });
      mockUpdate.mockResolvedValue({});

      const r = await InterviewService.scoreAnswer("s1", {
        question: "q2", answer: "a2", score: 90, isCorrect: true, difficulty: "medium", feedback: "good",
      });

      const call = mockUpdate.mock.calls[0][0];
      expect(call.where).toEqual({ id: "ir1" });
      expect(call.data.difficulty).toBe("hard");
      expect(call.data.streak).toBe(0);
      expect(call.data.questionLog).toHaveLength(2);
      expect(call.data.questionLog[1]).toMatchObject({ question: "q2", score: 90, isCorrect: true });
      expect(r.difficulty).toBe("hard");
      expect(r.questionCount).toBe(2);
    });

    it("答错：streak 转 -1，不调整（未达 -2）", async () => {
      mockFindFirst.mockResolvedValue({ id: "ir1", sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 0, questionLog: [] });
      mockUpdate.mockResolvedValue({});
      const r = await InterviewService.scoreAnswer("s1", {
        question: "q1", answer: "a1", score: 40, isCorrect: false, difficulty: "medium", feedback: "weak",
      });
      expect(r.difficulty).toBe("medium");
      expect(r.streak).toBe(-1);
    });

    it("无 in_progress 记录 → 抛错", async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(InterviewService.scoreAnswer("s1", { question: "q", answer: "a", score: 50, isCorrect: false, difficulty: "easy", feedback: "" })).rejects.toThrow();
    });
  });

  describe("finalize", () => {
    it("computeTotalScore + 置 completed + 返回总评", async () => {
      mockFindFirst.mockResolvedValue({
        id: "ir1", sessionId: "s1", status: "in_progress", difficulty: "medium", streak: 0,
        questionLog: [{ question: "q1", score: 80 }, { question: "q2", score: 60 }],
      });
      mockUpdate.mockResolvedValue({});

      const r = await InterviewService.finalize("s1", { improvement: "多练基础", weakPoints: ["闭包", "this"] });

      const call = mockUpdate.mock.calls[0][0];
      expect(call.data.totalScore).toBe(70); // (80+60)/2
      expect(call.data.status).toBe("completed");
      expect(call.data.weakPoints).toEqual(["闭包", "this"]);
      expect(call.data.improvement).toBe("多练基础");
      expect(r.totalScore).toBe(70);
      expect(r.questionCount).toBe(2);
    });

    it("无 in_progress → 抛错", async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(InterviewService.finalize("s1", { improvement: "x", weakPoints: [] })).rejects.toThrow();
    });
  });

  describe("getResult", () => {
    it("返回最新 InterviewResult（含已完成）", async () => {
      mockFindFirst.mockResolvedValue({ id: "ir1", status: "completed", totalScore: 75 });
      const r = await InterviewService.getResult("s1");
      expect(r?.totalScore).toBe(75);
    });

    it("无记录 → null", async () => {
      mockFindFirst.mockResolvedValue(null);
      expect(await InterviewService.getResult("s1")).toBeNull();
    });
  });
});
