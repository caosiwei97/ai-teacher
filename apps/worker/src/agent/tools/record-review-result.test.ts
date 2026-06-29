import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSubmitResult } = vi.hoisted(() => ({
  mockSubmitResult: vi.fn(),
}));

vi.mock("@ai-teacher/shared/services/review-service", () => ({
  ReviewService: { submitResult: mockSubmitResult },
}));

import { recordReviewResultTool } from "./record-review-result";

const ctx = { sessionId: "s1", userId: "u1", prisma: {} };

describe("recordReviewResult tool", () => {
  beforeEach(() => {
    mockSubmitResult.mockReset();
  });

  it("答对：调 ReviewService.submitResult，返回 success + trend/nextReviewAt", async () => {
    mockSubmitResult.mockResolvedValue({
      nodeId: "n1",
      title: "useState",
      memoryStrength: 1.0,
      lastReviewedAt: new Date("2026-06-29T12:00:00.000Z"),
      nextReviewAt: new Date("2026-07-01T12:00:00.000Z"),
      reviewInterval: 2,
      trend: "维持",
    });

    const result = await recordReviewResultTool.execute(
      { nodeId: "n1", correct: true },
      ctx,
    );

    expect(mockSubmitResult).toHaveBeenCalledWith("n1", true);
    expect(result).toMatchObject({
      success: true,
      nodeId: "n1",
      title: "useState",
      trend: "维持",
      reviewInterval: 2,
    });
    expect(result.nextReviewAt).toEqual(new Date("2026-07-01T12:00:00.000Z"));
  });

  it("答错：传 correct=false，返回趋势衰退", async () => {
    mockSubmitResult.mockResolvedValue({
      nodeId: "n1",
      title: "useState",
      memoryStrength: 0.7,
      lastReviewedAt: new Date("2026-06-29T12:00:00.000Z"),
      nextReviewAt: new Date("2026-06-30T12:00:00.000Z"),
      reviewInterval: 1,
      trend: "衰退",
    });

    const result = await recordReviewResultTool.execute(
      { nodeId: "n1", correct: false, note: "混淆了 state 更新" },
      ctx,
    );

    expect(mockSubmitResult).toHaveBeenCalledWith("n1", false);
    expect(result.trend).toBe("衰退");
    expect(result.note).toBe("混淆了 state 更新");
  });

  it("submitResult 抛错 → 不吞异常", async () => {
    mockSubmitResult.mockRejectedValue(new Error("node not found"));
    await expect(
      recordReviewResultTool.execute({ nodeId: "x", correct: true }, ctx),
    ).rejects.toThrow("node not found");
  });
});
