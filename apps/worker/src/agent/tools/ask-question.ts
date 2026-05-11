import type { ToolDefinition } from "@ai-teacher/agent";
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
      .max(10)
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
  promptSnippet: `**askQuestion 工具**：在新会话开始、用户输入学习主题后，使用此工具评估学习者的基础水平。根据学习主题的复杂度生成 5-10 个诊断选择题，覆盖多个维度：核心概念定义、前置知识检查、实际应用场景、常见误区辨析、进阶理解深度。每题 3-4 个梯度选项（从完全不了解→深入理解）。
调用后系统会在聊天中渲染 Tab 选项卡，学习者回答后你会收到答案，据此判断起始知识点。`,
  promptGuidelines: [
    "新会话的第一条用户消息是学习主题，此时应立即调用 askQuestion",
    "根据主题复杂度生成 5-10 个问题，简单主题 5 个，复杂主题 8-10 个",
    "题目维度要多样：核心定义、前置知识、应用场景、常见误区、进阶概念",
    "每题的 title 字段用中文标注维度，如'核心定义'、'前置知识'、'应用场景'、'常见误区'、'进阶理解'",
    "选项梯度要清晰：完全不了解 / 听说过但说不清 / 了解基本概念 / 能深入解释",
    "收到诊断答案后，综合分析用户各维度水平并自动开始教学",
  ],
};
