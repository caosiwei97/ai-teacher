// 面试评分算法（spec §4.2 / §9.2 Phase 3）
// 三档难度动态调整（连续2答对升/连续2答错降）+ 总评分计算。
// 纯函数，server（面试 API）与 worker（scoreAnswer tool）共用。

export type Difficulty = "easy" | "medium" | "hard";

// 难度档位顺序（升档 +1 / 降档 -1）
const DIFFICULTY_LEVEL: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};
const LEVEL_TO_DIFFICULTY: Difficulty[] = ["easy", "medium", "hard"];

// 连续答对/答错几次触发难度调整
const ADJUST_STREAK = 2;

/**
 * 难度动态调整（spec §4.2）：
 * - streak 正=连续答对，负=连续答错，0=无
 * - 连续 2 答对 → 升一档（封顶 hard）；连续 2 答错 → 降一档（封底 easy）
 * - 调整后 streak 归零（新难度重新计）；未达阈值则 streak 累加/翻转
 */
export function adjustDifficulty(
  currentDifficulty: Difficulty,
  streak: number,
  lastCorrect: boolean,
): { difficulty: Difficulty; streak: number } {
  // 计算新 streak：同向累加，反向重置为 ±1
  const newStreak = lastCorrect
    ? streak >= 0
      ? streak + 1
      : 1
    : streak <= 0
      ? streak - 1
      : -1;

  const level = DIFFICULTY_LEVEL[currentDifficulty];
  let newLevel = level;
  let finalStreak = newStreak;

  if (newStreak >= ADJUST_STREAK) {
    newLevel = Math.min(2, level + 1);
    finalStreak = 0; // 升档后归零
  } else if (newStreak <= -ADJUST_STREAK) {
    newLevel = Math.max(0, level - 1);
    finalStreak = 0; // 降档后归零
  }

  return { difficulty: LEVEL_TO_DIFFICULTY[newLevel], streak: finalStreak };
}

/**
 * 复盘总评分（spec §4.1 复盘）：各题分数平均，0-100，无题则 0。
 */
export function computeTotalScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return Math.round(sum / scores.length);
}
