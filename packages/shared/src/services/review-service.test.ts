import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSessionFindUnique, mockNodeFindUnique, mockNodeUpdate } = vi.hoisted(() => ({
  mockSessionFindUnique: vi.fn(),
  mockNodeFindUnique: vi.fn(),
  mockNodeUpdate: vi.fn(),
}));

vi.mock("@ai-teacher/db", () => ({
  prisma: {
    session: { findUnique: mockSessionFindUnique },
    node: { findUnique: mockNodeFindUnique, update: mockNodeUpdate },
  },
}));

import { ReviewService } from "./review-service";

const NOW = new Date("2026-06-29T12:00:00.000Z");

describe("ReviewService", () => {
  beforeEach(() => {
    mockSessionFindUnique.mockReset();
    mockNodeFindUnique.mockReset();
    mockNodeUpdate.mockReset();
  });

  describe("getDueNodes", () => {
    it("只返回 mastered 且到期的节点，带 isOverdue", async () => {
      mockSessionFindUnique.mockResolvedValue({
        roadmap: {
          nodes: [
            { id: "n1", index: 0, title: "A", description: "d", status: "mastered", masteryScore: 90, memoryStrength: 1.0, lastReviewedAt: null, nextReviewAt: null, reviewInterval: 1 },
            { id: "n2", index: 1, title: "B", description: "d", status: "mastered", masteryScore: 88, memoryStrength: 0.7, lastReviewedAt: NOW, nextReviewAt: new Date("2026-07-02T12:00:00.000Z"), reviewInterval: 2 },
            { id: "n3", index: 2, title: "C", description: "d", status: "in_progress", masteryScore: 50, memoryStrength: 1.0, lastReviewedAt: null, nextReviewAt: null, reviewInterval: 1 },
          ],
        },
      });

      const due = await ReviewService.getDueNodes("s1", NOW);

      expect(due).toHaveLength(1);
      expect(due[0].id).toBe("n1");
      expect(due[0].isOverdue).toBe(true);
    });

    it("session 无 roadmap → 空列表", async () => {
      mockSessionFindUnique.mockResolvedValue({ roadmap: null });
      expect(await ReviewService.getDueNodes("s1", NOW)).toEqual([]);
    });

    it("session 不存在 → 空列表", async () => {
      mockSessionFindUnique.mockResolvedValue(null);
      expect(await ReviewService.getDueNodes("s1", NOW)).toEqual([]);
    });
  });

  describe("submitResult", () => {
    it("答对：调 applyReviewResult + update 正确字段，返回 trend/nextReviewAt", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n1", title: "A", memoryStrength: 1.0, reviewInterval: 1,
      });

      const r = await ReviewService.submitResult("n1", true, NOW);

      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({
          memoryStrength: 1.0,
          reviewInterval: 2,
          lastReviewedAt: NOW,
          nextReviewAt: new Date("2026-07-01T12:00:00.000Z"),
        }),
      });
      expect(r.nodeId).toBe("n1");
      expect(r.title).toBe("A");
      expect(r.trend).toBe("维持");
      expect(r.reviewInterval).toBe(2);
    });

    it("答错：重置 1d + 强度下降 + 趋势衰退", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n1", title: "A", memoryStrength: 1.0, reviewInterval: 8,
      });

      const r = await ReviewService.submitResult("n1", false, NOW);

      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({
          memoryStrength: 0.7,
          reviewInterval: 1,
          nextReviewAt: new Date("2026-06-30T12:00:00.000Z"),
        }),
      });
      expect(r.trend).toBe("衰退");
    });

    it("节点不存在 → 抛错", async () => {
      mockNodeFindUnique.mockResolvedValue(null);
      await expect(ReviewService.submitResult("missing", true, NOW)).rejects.toThrow();
      expect(mockNodeUpdate).not.toHaveBeenCalled();
    });
  });

  describe("getSummary", () => {
    it("返回低强度 mastered 节点为薄弱点，按强度升序", async () => {
      mockSessionFindUnique.mockResolvedValue({
        roadmap: {
          nodes: [
            { id: "n1", index: 0, title: "A", description: "d", status: "mastered", masteryScore: 90, memoryStrength: 0.4, lastReviewedAt: NOW, nextReviewAt: NOW, reviewInterval: 1 },
            { id: "n2", index: 1, title: "B", description: "d", status: "mastered", masteryScore: 88, memoryStrength: 0.9, lastReviewedAt: NOW, nextReviewAt: NOW, reviewInterval: 16 },
            { id: "n3", index: 2, title: "C", description: "d", status: "mastered", masteryScore: 90, memoryStrength: 0.2, lastReviewedAt: NOW, nextReviewAt: NOW, reviewInterval: 1 },
            { id: "n4", index: 3, title: "D", description: "d", status: "in_progress", masteryScore: 50, memoryStrength: 1.0, lastReviewedAt: null, nextReviewAt: null, reviewInterval: 1 },
          ],
        },
      });

      const summary = await ReviewService.getSummary("s1");

      expect(summary.totalMastered).toBe(3);
      expect(summary.weakNodes.map((n: { id: string }) => n.id)).toEqual(["n3", "n1"]); // 0.2, 0.4 升序
    });

    it("无 mastered → 空 weakNodes，totalMastered=0", async () => {
      mockSessionFindUnique.mockResolvedValue({ roadmap: { nodes: [] } });
      const summary = await ReviewService.getSummary("s1");
      expect(summary.weakNodes).toEqual([]);
      expect(summary.totalMastered).toBe(0);
    });
  });
});
