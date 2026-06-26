import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.mock 会被提升，用 vi.hoisted 安全引用 mock fn
const { mockNodeUpdate, mockNodeFindUnique, mockTransaction } = vi.hoisted(() => ({
  mockNodeUpdate: vi.fn(),
  mockNodeFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@ai-teacher/db", () => ({
  prisma: {
    node: {
      update: mockNodeUpdate,
      findUnique: mockNodeFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

import { NodeService } from "./node-service";

describe("NodeService", () => {
  beforeEach(() => {
    mockNodeUpdate.mockReset();
    mockNodeFindUnique.mockReset();
    mockTransaction.mockReset();
    mockNodeUpdate.mockResolvedValue({});
    mockTransaction.mockResolvedValue([]);
  });

  describe("updateMastery", () => {
    it("score<80：更新为 in_progress，不触发 autoAdvance", async () => {
      await NodeService.updateMastery("n1", 60, { note: "weak" });

      expect(mockNodeUpdate).toHaveBeenCalledTimes(1);
      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({
          masteryScore: 60,
          status: "in_progress",
          masteredAt: null,
        }),
      });
      // autoAdvance 未触发 → findUnique 未调用
      expect(mockNodeFindUnique).not.toHaveBeenCalled();
    });

    it("score>=80：更新为 mastered，触发 autoAdvance", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n1",
        index: 0,
        roadmap: {
          nodes: [
            { id: "n1", index: 0, status: "mastered" },
            { id: "n2", index: 1, status: "not_started" },
          ],
        },
      });

      await NodeService.updateMastery("n1", 85, { note: "good" });

      // 第一次：当前节点 mastered；第二次：autoAdvance 推进 n2
      expect(mockNodeUpdate).toHaveBeenCalledTimes(2);
      expect(mockNodeUpdate).toHaveBeenNthCalledWith(1, {
        where: { id: "n1" },
        data: expect.objectContaining({
          masteryScore: 85,
          status: "mastered",
          masteredAt: expect.any(Date),
        }),
      });
      expect(mockNodeFindUnique).toHaveBeenCalledTimes(1);
    });

    it("score=80 边界：触发 autoAdvance", async () => {
      mockNodeFindUnique.mockResolvedValue(null);

      await NodeService.updateMastery("n1", 80, {});

      expect(mockNodeFindUnique).toHaveBeenCalledTimes(1);
    });

    it("reviewLog 被 JSON 深拷贝传入", async () => {
      const reviewLog = { score: 60, nested: { a: 1 } };
      await NodeService.updateMastery("n1", 60, reviewLog);

      const call = mockNodeUpdate.mock.calls[0][0];
      expect(call.data.reviewLog).toEqual({ score: 60, nested: { a: 1 } });
      expect(call.data.reviewLog).not.toBe(reviewLog);
      expect(call.data.reviewLog.nested).not.toBe(reviewLog.nested);
    });
  });

  describe("autoAdvance", () => {
    it("有下一个 not_started 节点：更新为 in_progress", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n1",
        index: 0,
        roadmap: {
          nodes: [
            { id: "n1", index: 0, status: "mastered" },
            { id: "n2", index: 1, status: "not_started" },
            { id: "n3", index: 2, status: "not_started" },
          ],
        },
      });

      await NodeService.autoAdvance("n1");

      expect(mockNodeUpdate).toHaveBeenCalledTimes(1);
      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: "n2" },
        data: { status: "in_progress" },
      });
    });

    it("无下一个 not_started 节点：不 update", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n1",
        index: 0,
        roadmap: {
          nodes: [
            { id: "n1", index: 0, status: "mastered" },
            { id: "n2", index: 1, status: "in_progress" },
          ],
        },
      });

      await NodeService.autoAdvance("n1");

      expect(mockNodeUpdate).not.toHaveBeenCalled();
    });

    it("只取 index 更大的第一个 not_started（跳过更小 index）", async () => {
      mockNodeFindUnique.mockResolvedValue({
        id: "n2",
        index: 1,
        roadmap: {
          nodes: [
            { id: "n1", index: 0, status: "not_started" }, // index 更小，跳过
            { id: "n2", index: 1, status: "mastered" },
            { id: "n3", index: 2, status: "not_started" }, // ← 应选这个
          ],
        },
      });

      await NodeService.autoAdvance("n2");

      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: "n3" },
        data: { status: "in_progress" },
      });
    });

    it("node 不存在：直接 return，不 update", async () => {
      mockNodeFindUnique.mockResolvedValue(null);

      await NodeService.autoAdvance("missing");

      expect(mockNodeUpdate).not.toHaveBeenCalled();
    });
  });

  describe("advanceNode", () => {
    it("事务更新两个节点（当前 mastered + 下一 in_progress）", async () => {
      await NodeService.advanceNode("n1", "n2", 90);

      // node.update 被调用 2 次（构造事务参数）
      expect(mockNodeUpdate).toHaveBeenCalledTimes(2);
      expect(mockNodeUpdate).toHaveBeenNthCalledWith(1, {
        where: { id: "n1" },
        data: expect.objectContaining({
          status: "mastered",
          masteryScore: 90,
          masteredAt: expect.any(Date),
        }),
      });
      expect(mockNodeUpdate).toHaveBeenNthCalledWith(2, {
        where: { id: "n2" },
        data: { status: "in_progress" },
      });
      // $transaction 收到 2 元素数组
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransaction.mock.calls[0][0]).toHaveLength(2);
    });
  });
});
