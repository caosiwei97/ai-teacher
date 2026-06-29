import { describe, it, expect } from "vitest";
import {
  isReviewDue,
  computeNextInterval,
  applyReviewResult,
  selectDueReviewNodes,
  MAX_INTERVAL_DAYS,
  type ReviewableNode,
} from "./spaced-repetition";

const DAY_MS = 24 * 60 * 60 * 1000;
// 固定 now，便于断言 nextReviewAt
const NOW = new Date("2026-06-29T12:00:00.000Z");
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);

describe("spaced-repetition（间隔重复算法）", () => {
  describe("isReviewDue", () => {
    it("nextReviewAt 为 null（未复习/老数据）：到期（逾期优先呈现）", () => {
      expect(isReviewDue({ nextReviewAt: null }, NOW)).toBe(true);
    });

    it("nextReviewAt 在未来：未到期", () => {
      expect(isReviewDue({ nextReviewAt: addDays(NOW, 3) }, NOW)).toBe(false);
    });

    it("nextReviewAt 已过：到期", () => {
      expect(isReviewDue({ nextReviewAt: addDays(NOW, -1) }, NOW)).toBe(true);
    });

    it("nextReviewAt 恰好等于 now：到期（边界）", () => {
      expect(isReviewDue({ nextReviewAt: NOW }, NOW)).toBe(true);
    });

    it("不传 now 默认用当前时间：未来时间未到期", () => {
      expect(isReviewDue({ nextReviewAt: addDays(new Date(), 5) })).toBe(false);
    });
  });

  describe("computeNextInterval", () => {
    it("答对：间隔翻倍 1→2→4→8→16→32", () => {
      expect(computeNextInterval(1, true)).toBe(2);
      expect(computeNextInterval(2, true)).toBe(4);
      expect(computeNextInterval(4, true)).toBe(8);
      expect(computeNextInterval(8, true)).toBe(16);
      expect(computeNextInterval(16, true)).toBe(32);
    });

    it("答对：已达封顶 32d 不再增长", () => {
      expect(computeNextInterval(32, true)).toBe(32);
      expect(computeNextInterval(MAX_INTERVAL_DAYS, true)).toBe(32);
    });

    it("答错：任意间隔重置为 1d", () => {
      expect(computeNextInterval(1, false)).toBe(1);
      expect(computeNextInterval(8, false)).toBe(1);
      expect(computeNextInterval(32, false)).toBe(1);
    });
  });

  describe("applyReviewResult", () => {
    it("答对（刚掌握满强度）：间隔翻倍、强度封顶 1.0、趋势维持、下次=now+2d", () => {
      const r = applyReviewResult({ memoryStrength: 1.0, reviewInterval: 1 }, true, NOW);
      expect(r.reviewInterval).toBe(2);
      expect(r.memoryStrength).toBe(1.0);
      expect(r.lastReviewedAt).toEqual(NOW);
      expect(r.nextReviewAt).toEqual(addDays(NOW, 2));
      expect(r.trend).toBe("维持");
    });

    it("答对（强度曾衰退 0.7）：强度回升、趋势强化", () => {
      const r = applyReviewResult({ memoryStrength: 0.7, reviewInterval: 2 }, true, NOW);
      expect(r.reviewInterval).toBe(4);
      expect(r.memoryStrength).toBeCloseTo(0.85, 6);
      expect(r.trend).toBe("强化");
    });

    it("答对（0.9 接近满）：强度封顶 1.0、趋势强化（有上升）", () => {
      const r = applyReviewResult({ memoryStrength: 0.9, reviewInterval: 4 }, true, NOW);
      expect(r.memoryStrength).toBe(1.0);
      expect(r.trend).toBe("强化");
    });

    it("答错（满强度）：间隔重置 1d、强度下降、趋势衰退、下次=now+1d", () => {
      const r = applyReviewResult({ memoryStrength: 1.0, reviewInterval: 8 }, false, NOW);
      expect(r.reviewInterval).toBe(1);
      expect(r.memoryStrength).toBeCloseTo(0.7, 6);
      expect(r.nextReviewAt).toEqual(addDays(NOW, 1));
      expect(r.trend).toBe("衰退");
    });

    it("答错（低强度 0.1）：强度 floor 0.0、仍趋势衰退", () => {
      const r = applyReviewResult({ memoryStrength: 0.1, reviewInterval: 16 }, false, NOW);
      expect(r.reviewInterval).toBe(1);
      expect(r.memoryStrength).toBe(0.0);
      expect(r.trend).toBe("衰退");
    });

    it("连续答对到封顶：1→2→4→8→16→32→32，强度维持", () => {
      let state = { memoryStrength: 1.0, reviewInterval: 1 };
      const intervals: number[] = [];
      for (let i = 0; i < 7; i++) {
        state = applyReviewResult(state, true, NOW);
        intervals.push(state.reviewInterval);
      }
      expect(intervals).toEqual([2, 4, 8, 16, 32, 32, 32]);
      expect(state.memoryStrength).toBe(1.0);
    });
  });
});

describe("selectDueReviewNodes", () => {
  const baseNode = (over: Partial<ReviewableNode>): ReviewableNode => ({
    id: over.id ?? "n",
    index: over.index ?? 0,
    title: over.title ?? "t",
    description: over.description ?? "d",
    status: over.status ?? "mastered",
    masteryScore: over.masteryScore ?? 90,
    memoryStrength: over.memoryStrength ?? 1.0,
    lastReviewedAt: over.lastReviewedAt ?? null,
    nextReviewAt: over.nextReviewAt ?? null,
    reviewInterval: over.reviewInterval ?? 1,
  });

  it("只选 mastered 节点（排除 not_started/in_progress）", () => {
    const nodes = [
      baseNode({ id: "n1", status: "mastered", nextReviewAt: null }),
      baseNode({ id: "n2", status: "in_progress", nextReviewAt: null }),
      baseNode({ id: "n3", status: "not_started", nextReviewAt: null }),
      baseNode({ id: "n4", status: "in_progress", masteryScore: 90, nextReviewAt: null }), // masteryScore>=80 但未 mastered → 不选
    ];
    const due = selectDueReviewNodes(nodes, NOW);
    expect(due.map((n) => n.id)).toEqual(["n1"]);
  });

  it("mastered 且到期（nextReviewAt null 或过去）→ 选，并标 isOverdue", () => {
    const nodes = [
      baseNode({ id: "n1", nextReviewAt: null }), // 逾期
      baseNode({ id: "n2", nextReviewAt: addDays(NOW, -1) }), // 过去
      baseNode({ id: "n3", nextReviewAt: addDays(NOW, 3) }), // 未来，不选
    ];
    const due = selectDueReviewNodes(nodes, NOW);
    expect(due.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(due[0].isOverdue).toBe(true); // null → 逾期
    expect(due[1].isOverdue).toBe(false); // 有明确时间且已过
  });

  it("保留记忆字段供 prompt 使用", () => {
    const nodes = [
      baseNode({ id: "n1", memoryStrength: 0.7, reviewInterval: 4, nextReviewAt: null }),
    ];
    const due = selectDueReviewNodes(nodes, NOW);
    expect(due[0].memoryStrength).toBe(0.7);
    expect(due[0].reviewInterval).toBe(4);
  });

  it("无 mastered 节点 → 空列表", () => {
    expect(selectDueReviewNodes([], NOW)).toEqual([]);
  });
});
