// 间隔重复算法（spec §3.4 / §7.1 / §9.2）
// 复用 sigma 间隔策略 1d→2d→4d→8d→16d→32d（封顶 32d），持久化到 DB。
// 纯函数，server（到期清单）与 worker（更新记忆强度）共用。

const DAY_MS = 24 * 60 * 60 * 1000;

// 答对：记忆强度增益；答错：衰减幅度
const STRENGTH_GAIN = 0.15;
const STRENGTH_LOSS = 0.3;
const STRENGTH_MAX = 1.0;
const STRENGTH_MIN = 0.0;

export const MAX_INTERVAL_DAYS = 32;

export type MemoryTrend = "强化" | "维持" | "衰退";

/** 节点持久化的复习状态（对应 Node 表的间隔重复字段） */
export interface ReviewMemoryState {
  memoryStrength: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  reviewInterval: number;
}

/** 可复习的节点（mastered 判定 + 记忆字段，供 selectDueReviewNodes 纯函数消费） */
export interface ReviewableNode {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
  memoryStrength: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  reviewInterval: number;
}

/** 一次复习提交后的产出（对应 spec §3.3 结束输出） */
export interface ReviewOutcome {
  memoryStrength: number;
  lastReviewedAt: Date;
  nextReviewAt: Date;
  reviewInterval: number;
  trend: MemoryTrend;
}

/**
 * 到期判断（spec §7.1）：nextReviewAt 为 null（未复习/老数据，按"逾期"优先呈现）
 * 或 ≤ now 即到期。
 */
export function isReviewDue(
  state: { nextReviewAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (state.nextReviewAt === null) return true;
  return state.nextReviewAt.getTime() <= now.getTime();
}

/**
 * 计算下次复习间隔（天）：答对翻倍（封顶 32d），答错重置 1d（spec §9.2）。
 */
export function computeNextInterval(
  currentIntervalDays: number,
  correct: boolean,
): number {
  if (!correct) return 1;
  return Math.min(MAX_INTERVAL_DAYS, currentIntervalDays * 2);
}

/**
 * 应用一次复习结果，返回新的记忆状态 + 趋势。
 * - 答对：间隔翻倍、强度 +0.15（封顶 1.0）；强度上升→强化，已封顶→维持
 * - 答错：间隔重置 1d、强度 -0.3（floor 0.0）→衰退（spec §3.3）
 */
export function applyReviewResult(
  prev: { memoryStrength: number; reviewInterval: number },
  correct: boolean,
  now: Date = new Date(),
): ReviewOutcome {
  const reviewInterval = computeNextInterval(prev.reviewInterval, correct);

  let memoryStrength: number;
  let trend: MemoryTrend;
  if (correct) {
    memoryStrength = Math.min(STRENGTH_MAX, prev.memoryStrength + STRENGTH_GAIN);
    trend = memoryStrength > prev.memoryStrength ? "强化" : "维持";
  } else {
    memoryStrength = Math.max(STRENGTH_MIN, prev.memoryStrength - STRENGTH_LOSS);
    trend = "衰退";
  }

  return {
    memoryStrength,
    lastReviewedAt: now,
    nextReviewAt: new Date(now.getTime() + reviewInterval * DAY_MS),
    reviewInterval,
    trend,
  };
}

/**
 * 从节点列表筛选今日到期复习项（spec §3.1 智能推荐）：
 * 1. 仅 mastered 节点（status==='mastered'，复习范围=已掌握知识点，§5.2）
 * 2. isReviewDue（nextReviewAt null/逾期 优先）
 * 3. 标记 isOverdue（nextReviewAt===null，从未复习/老数据）
 * 纯函数，server（到期清单 API）与 worker（考官 prompt 上下文）共用。
 */
export function selectDueReviewNodes(
  nodes: ReviewableNode[],
  now: Date = new Date(),
): Array<ReviewableNode & { isOverdue: boolean }> {
  return nodes
    .filter((n) => n.status === "mastered")
    .filter((n) => isReviewDue(n, now))
    .map((n) => ({ ...n, isOverdue: n.nextReviewAt === null }));
}
