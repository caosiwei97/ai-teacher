import type { ToolDefinition } from "../types";
import { z } from "zod";

export const askQuestionTool: ToolDefinition = {
  name: "askQuestion",
  description:
    "向学习者展示选择题来评估其基础水平。用于新会话开始时的诊断摸底，在聊天流中直接展示 Tab 选项卡。",
  inputSchema: z.object({
    questions: z
      .array(
        z.object({
          id: z.string().describe("题目唯一标识，如 d1"),
          question: z.string().describe("题目内容"),
          title: z.string().describe("Tab 标题，如'核心定义'、'背景调查'"),
          options: z
            .array(
              z.object({
                id: z.string().describe("选项 ID，如 a/b/c/d"),
                text: z.string().describe("选项内容"),
              }),
            )
            .min(2)
            .describe("选项列表"),
        }),
      )
      .min(1)
      .max(5)
      .describe("诊断题目列表"),
    nodeId: z.string().describe("固定为 'diagnosis'"),
    question: z.string().describe("整体标题，如'让我们了解一下你的基础'"),
  }),
  execute: async (params) => {
    const p = params as {
      questions: Array<{
        id: string;
        question: string;
        title: string;
        options: Array<{ id: string; text: string }>;
      }>;
      nodeId: string;
      question: string;
    };
    return {
      success: true,
      questions: p.questions,
      nodeId: p.nodeId,
      question: p.question,
    };
  },
  promptSnippet: `**askQuestion 工具**：在新会话开始、用户输入学习主题后，使用此工具评估学习者的基础水平。根据学习主题的复杂度生成 3-5 个诊断选择题，覆盖关键维度：核心概念定义、前置知识检查、实际应用场景。每题 3-4 个梯度选项（从完全不了解→深入理解）。
调用后系统会在你的回复文字**下方**自动渲染 Tab 选项卡。⚠️ 绝对不要在文字回复中重复列出题目内容或描述题目数量，只需简短引导即可（如"先来做几道题看看你的基础"）。`,
  promptGuidelines: [
    "新会话的第一条用户消息是学习主题，此时应立即调用 askQuestion",
    "根据主题复杂度生成 3-5 个问题，简单主题 3 个，复杂主题 4-5 个",
    "题目维度要多样：核心定义、前置知识、应用场景、常见误区、进阶概念",
    "每题的 title 字段用中文标注维度且必须唯一，不能有两道题使用相同的 title。如同一维度有多题，用具体子话题区分，如'前置知识：Python 基础'、'前置知识：异步编程'",
    "选项梯度要清晰：完全不了解 / 听说过但说不清 / 了解基本概念 / 能深入解释",
    "如果学习主题涉及编程或软件开发，必须加一道题询问用户偏好的编程语言，选项包含：Python / JavaScript / TypeScript / Java / C++ / 其他。这道题的答案会影响后续 pushCode 和 executeCode 的语言选择",
    "收到诊断答案后，综合分析用户各维度水平（包括语言偏好）并自动开始教学",
  ],
};
