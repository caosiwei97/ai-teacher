import type { ToolDefinition } from "../types";
import { z } from "zod";
import { InterviewService } from "@ai-teacher/shared/services/interview-service";

// 面试模式：复盘，计算总评分 + 薄弱点 + 改进建议，置面试完成（spec §4.1 复盘）。
export const finalizeInterviewTool: ToolDefinition = {
  name: "finalizeInterview",
  description:
    "结束面试并生成复盘：计算总评分（各题平均）+ 记录薄弱点 + 改进建议，置面试完成。候选人说结束或面试充分（≥5题）时调用",
  inputSchema: z.object({
    improvement: z.string().describe("改进建议，2-3 句（复盘才给的唯一讲解）"),
    weakPoints: z.array(z.string()).describe("薄弱点清单"),
  }),
  execute: async (params, ctx) => {
    const p = params as { improvement: string; weakPoints: string[] };
    const result = await InterviewService.finalize(ctx.sessionId, p);
    return { success: true, ...result };
  },
  promptSnippet: `**finalizeInterview 工具**：结束面试时调用（候选人说"结束/复盘"或已问 ≥5 题）。传入 improvement（改进建议 2-3 句，这是面试中唯一允许的讲解）+ weakPoints（薄弱点清单）。系统计算总评分（各题平均）并置面试完成，返回 totalScore + weakPoints + improvement + questionCount。调用后用 renderUI 产 interviewScore 评分卡（totalScore/difficulty/weakPoints/improvement/questionCount），配一句话总结结束。一场面试只调用一次。`,
  promptGuidelines: [
    "复盘前不要讲解或给建议——这是面试全程唯一的讲解时机",
    "improvement 针对薄弱点给可执行的改进方向",
    "调用后必须用 renderUI 产 interviewScore 评分卡呈现复盘",
  ],
};
