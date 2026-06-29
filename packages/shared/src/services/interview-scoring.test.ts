import { describe, it, expect } from "vitest";
import {
  adjustDifficulty,
  computeTotalScore,
  type Difficulty,
} from "./interview-scoring";

describe("interview-scoring（面试评分算法）", () => {
  describe("adjustDifficulty", () => {
    it("连续 2 答对：medium → hard，streak 归零", () => {
      // 第1次答对：streak 0 → 1，未达2，不调整
      let r = adjustDifficulty("medium", 0, true);
      expect(r).toEqual({ difficulty: "medium", streak: 1 });
      // 第2次答对：streak 1 → 2，升档 medium→hard，streak 归零
      r = adjustDifficulty("medium", 1, true);
      expect(r).toEqual({ difficulty: "hard", streak: 0 });
    });

    it("连续 2 答错：medium → easy，streak 归零", () => {
      let r = adjustDifficulty("medium", 0, false);
      expect(r).toEqual({ difficulty: "medium", streak: -1 });
      r = adjustDifficulty("medium", -1, false);
      expect(r).toEqual({ difficulty: "easy", streak: 0 });
    });

    it("答对答错交替：streak 在 ±1 间切换，不调整", () => {
      let r = adjustDifficulty("medium", 0, true);
      expect(r).toEqual({ difficulty: "medium", streak: 1 });
      r = adjustDifficulty("medium", 1, false);
      expect(r).toEqual({ difficulty: "medium", streak: -1 });
      r = adjustDifficulty("medium", -1, true);
      expect(r).toEqual({ difficulty: "medium", streak: 1 });
    });

    it("hard 已封顶：连续2答对不再升", () => {
      const r = adjustDifficulty("hard", 1, true);
      expect(r).toEqual({ difficulty: "hard", streak: 0 });
    });

    it("easy 已封底：连续2答错不再降", () => {
      const r = adjustDifficulty("easy", -1, false);
      expect(r).toEqual({ difficulty: "easy", streak: 0 });
    });

    it("easy 连续2答对 → medium", () => {
      const r = adjustDifficulty("easy", 1, true);
      expect(r.difficulty).toBe("medium");
      expect(r.streak).toBe(0);
    });

    it("hard 连续2答错 → medium", () => {
      const r = adjustDifficulty("hard", -1, false);
      expect(r.difficulty).toBe("medium");
      expect(r.streak).toBe(0);
    });

    it("streak 正负切换重置：连续答对后答错，streak 从 -1 起算", () => {
      // streak=2（已升档归零）后答错 → streak -1
      const r = adjustDifficulty("hard", 0, false);
      expect(r).toEqual({ difficulty: "hard", streak: -1 });
    });
  });

  describe("computeTotalScore", () => {
    it("多题平均分（四舍五入）", () => {
      expect(computeTotalScore([80, 60, 100])).toBe(80);
      expect(computeTotalScore([70, 85])).toBe(78); // 77.5 → 78
    });

    it("空列表 → 0", () => {
      expect(computeTotalScore([])).toBe(0);
    });

    it("单题", () => {
      expect(computeTotalScore([90])).toBe(90);
    });
  });

  describe("Difficulty 类型", () => {
    it("三档：easy/medium/hard", () => {
      const d: Difficulty[] = ["easy", "medium", "hard"];
      expect(d).toHaveLength(3);
    });
  });
});
