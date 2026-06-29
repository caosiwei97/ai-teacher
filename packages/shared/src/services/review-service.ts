// 复习模式数据服务（spec §3）：到期清单 / 提交结果更新记忆强度 / 薄弱点汇总。
// 算法源用 spaced-repetition 纯函数；本服务封装 prisma 读写。
// server（review API）与 worker（recordReviewResult tool）共用，单一更新入口。

import { prisma } from "@ai-teacher/db";
import {
  applyReviewResult,
  selectDueReviewNodes,
  type ReviewOutcome,
  type ReviewableNode,
} from "./spaced-repetition";

// 薄弱点阈值：memoryStrength 低于此值视为衰退需重学（spec §3.3 薄弱点清单）
const WEAK_STRENGTH_THRESHOLD = 0.6;

export interface ReviewDueItem {
  id: string;
  index: number;
  title: string;
  description: string;
  memoryStrength: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  reviewInterval: number;
  isOverdue: boolean;
}

export interface ReviewSubmitResult extends ReviewOutcome {
  nodeId: string;
  title: string;
}

export interface ReviewSummary {
  totalMastered: number;
  weakNodes: Array<{
    id: string;
    title: string;
    memoryStrength: number;
    reviewInterval: number;
    lastReviewedAt: Date | null;
  }>;
}

export const ReviewService = {
  /** 今日到期复习清单（spec §3.1 智能推荐）：mastered + 间隔重复到期 */
  async getDueNodes(sessionId: string, now: Date = new Date()): Promise<ReviewDueItem[]> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { roadmap: { include: { nodes: { orderBy: { index: "asc" } } } } },
    });
    if (!session?.roadmap) return [];
    const due = selectDueReviewNodes(
      session.roadmap.nodes as ReviewableNode[],
      now,
    );
    return due.map((n) => ({
      id: n.id,
      index: n.index,
      title: n.title,
      description: n.description,
      memoryStrength: n.memoryStrength,
      lastReviewedAt: n.lastReviewedAt,
      nextReviewAt: n.nextReviewAt,
      reviewInterval: n.reviewInterval,
      isOverdue: n.isOverdue,
    }));
  },

  /** 提交复习结果，更新记忆强度与下次复习时间（spec §3.3）。抽认卡/回忆测验共用入口 */
  async submitResult(
    nodeId: string,
    correct: boolean,
    now: Date = new Date(),
  ): Promise<ReviewSubmitResult> {
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, title: true, memoryStrength: true, reviewInterval: true },
    });
    if (!node) throw new Error(`Review node not found: ${nodeId}`);

    const outcome = applyReviewResult(
      { memoryStrength: node.memoryStrength, reviewInterval: node.reviewInterval },
      correct,
      now,
    );
    await prisma.node.update({
      where: { id: nodeId },
      data: {
        memoryStrength: outcome.memoryStrength,
        lastReviewedAt: outcome.lastReviewedAt,
        nextReviewAt: outcome.nextReviewAt,
        reviewInterval: outcome.reviewInterval,
      },
    });
    return { ...outcome, nodeId: node.id, title: node.title };
  },

  /** 薄弱点汇总（spec §3.3 错题本 + 薄弱点清单）：低记忆强度 mastered 节点，可一键转回学习模式重学 */
  async getSummary(sessionId: string): Promise<ReviewSummary> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { roadmap: { include: { nodes: { orderBy: { index: "asc" } } } } },
    });
    const nodes = (session?.roadmap?.nodes ?? []) as ReviewableNode[];
    const mastered = nodes.filter((n) => n.status === "mastered");
    const weakNodes = mastered
      .filter((n) => n.memoryStrength < WEAK_STRENGTH_THRESHOLD)
      .sort((a, b) => a.memoryStrength - b.memoryStrength)
      .map((n) => ({
        id: n.id,
        title: n.title,
        memoryStrength: n.memoryStrength,
        reviewInterval: n.reviewInterval,
        lastReviewedAt: n.lastReviewedAt,
      }));
    return { totalMastered: mastered.length, weakNodes };
  },
};
