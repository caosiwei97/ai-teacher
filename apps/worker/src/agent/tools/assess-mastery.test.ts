import { describe, it, expect, beforeEach, vi } from "vitest";
import { assessMasteryTool } from "./assess-mastery";

// assessMastery 的 prisma 通过 ctx 依赖注入，直接传 mock 对象（无需 vi.mock 模块）
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const ctx = {
  sessionId: "test-session",
  userId: "test-user",
  prisma: {
    node: { update: mockUpdate, findUnique: mockFindUnique, findMany: mockFindMany },
  },
};

const baseParams = {
  conceptId: "n1",
  score: 85,
  strengths: ["理解 A"],
  gaps: ["B 不熟"],
  misconceptions: [{ belief: "错认", rootCause: "根因", resolved: false }],
};

describe("assessMastery tool", () => {
  beforeEach(() => {
    mockUpdate.mockReset().mockResolvedValue({});
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
  });

  describe("execute — score<80", () => {
    it("更新为 in_progress，返回 { success, ...p }，无 roadmapUpdate", async () => {
      const result = await assessMasteryTool.execute({ ...baseParams, score: 60 }, ctx);

      expect(result).toMatchObject({ success: true, conceptId: "n1", score: 60 });
      expect(result).not.toHaveProperty("roadmapUpdate");
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({
          masteryScore: 60,
          status: "in_progress",
          masteredAt: null,
        }),
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });
  });

  describe("execute — score>=80", () => {
    it("有 nextNode：返回过渡 instruction + roadmapUpdate + activatedNextNode", async () => {
      mockFindUnique.mockResolvedValue({
        id: "n1",
        index: 0,
        roadmapId: "r1",
        title: "Node1",
        roadmap: {
          nodes: [
            { id: "n1", index: 0, status: "mastered" },
            { id: "n2", index: 1, status: "not_started", title: "Node2" },
          ],
        },
      });
      mockFindMany.mockResolvedValue([
        { id: "n1", index: 0, status: "mastered" },
        { id: "n2", index: 1, status: "in_progress" },
      ]);

      const result: any = await assessMasteryTool.execute(baseParams, ctx);

      expect(result.success).toBe(true);
      expect(result.activatedNextNode).toEqual({ id: "n2", title: "Node2" });
      expect(result.instruction).toContain("Node2");
      expect(result.instruction).toContain("STOP");
      expect(result.roadmapUpdate).toBeDefined();
      expect(result.roadmapUpdate.nodes).toHaveLength(2);
      expect(result.sessionUpdate).toEqual({ masteredNodes: 1, totalNodes: 2 });
    });

    it("无 nextNode（全部掌握）：返回结业 instruction", async () => {
      mockFindUnique.mockResolvedValue({
        id: "n1",
        index: 1,
        roadmapId: "r1",
        title: "Node1",
        roadmap: {
          nodes: [
            { id: "n0", index: 0, status: "mastered" },
            { id: "n1", index: 1, status: "mastered" },
          ],
        },
      });
      mockFindMany.mockResolvedValue([
        { id: "n0", index: 0, status: "mastered" },
        { id: "n1", index: 1, status: "mastered" },
      ]);

      const result: any = await assessMasteryTool.execute(baseParams, ctx);

      expect(result.activatedNextNode).toBeUndefined();
      expect(result.instruction).toContain("All nodes have been mastered");
      expect(result.sessionUpdate).toEqual({ masteredNodes: 2, totalNodes: 2 });
    });

    it("node 不存在（findUnique 返回 null）：返回 { success, ...p }", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result: any = await assessMasteryTool.execute(baseParams, ctx);

      expect(result).toMatchObject({ success: true, conceptId: "n1", score: 85 });
      expect(result).not.toHaveProperty("roadmapUpdate");
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("score=80 边界：触发 findUnique 查找下一节点", async () => {
      mockFindUnique.mockResolvedValue(null);

      await assessMasteryTool.execute({ ...baseParams, score: 80 }, ctx);

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: expect.objectContaining({ masteryScore: 80, status: "mastered" }),
      });
    });
  });

  describe("inputSchema", () => {
    it("合法输入通过", () => {
      expect(() => assessMasteryTool.inputSchema.parse(baseParams)).not.toThrow();
    });

    it("score 超出 0-100 被拒", () => {
      expect(() =>
        assessMasteryTool.inputSchema.parse({ ...baseParams, score: 101 }),
      ).toThrow();
      expect(() =>
        assessMasteryTool.inputSchema.parse({ ...baseParams, score: -1 }),
      ).toThrow();
    });

    it("缺必填字段被拒", () => {
      expect(() => {
        const { conceptId, ...rest } = baseParams;
        assessMasteryTool.inputSchema.parse(rest);
      }).toThrow();
    });

    it("misconceptions 结构非法被拒", () => {
      expect(() =>
        assessMasteryTool.inputSchema.parse({
          ...baseParams,
          misconceptions: [{ belief: "错" }], // 缺 rootCause/resolved
        }),
      ).toThrow();
    });
  });
});
