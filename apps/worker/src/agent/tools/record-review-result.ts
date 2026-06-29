import type { ToolDefinition } from "../types";
import { z } from "zod";
import { ReviewService } from "@ai-teacher/shared/services/review-service";

// 复习模式：记录一次提取练习结果，按间隔重复算法更新记忆强度（spec §3.3）
// 抽认卡（学习者自评）与回忆测验（考官评分）共用此入口。
export const recordReviewResultTool: ToolDefinition = {
  name: "recordReviewResult",
  description:
    "记录一次复习结果，按间隔重复算法更新知识点的记忆强度与下次复习时间（答对间隔翻倍，答错重置 1d）",
  inputSchema: z.object({
    nodeId: z.string().describe("被复习的知识点 ID"),
    correct: z.boolean().describe("学习者是否正确回忆"),
    note: z.string().optional().describe("评语或薄弱点备注"),
  }),
  execute: async (params) => {
    const p = params as { nodeId: string; correct: boolean; note?: string };
    const outcome = await ReviewService.submitResult(p.nodeId, p.correct);
    return { success: true, ...outcome, note: p.note };
  },
  promptSnippet: `**recordReviewResult 工具**：每个知识点复习完、学习者给出对错后必须调用。传入 nodeId、correct（是否正确回忆）。系统按间隔重复算法更新记忆强度与下次复习时间（答对间隔翻倍 1→2→4→8→16→32d，答错重置 1d），返回 trend（强化/维持/衰退）与 nextReviewAt，供你在复习总结中使用。`,
  promptGuidelines: [
    "回忆测验：学习者作答后，你评判对错，然后调用本工具记录",
    '抽认卡：学习者翻面后自评，文字告知"答对/答错"后，你调用本工具记录',
    "答错时先给 1-2 句关键提示（不重讲概念），再调用本工具",
    "一个知识点只记录一次，记录后即推进下一题",
  ],
};
