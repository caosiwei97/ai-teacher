import { z } from 'zod';

export const DiagnosticQuestion = z.object({
  id: z.string().describe("题目唯一标识"),
  nodeIndex: z.number().int().min(0).describe("对应的知识图谱节点序号"),
  question: z.string().describe("题目内容"),
  type: z.enum(["choice", "open"]).describe("题型：选择题或简答题"),
  options: z
    .array(
      z.object({
        label: z.string().describe("选项标识，如 A/B/C/D"),
        text: z.string().describe("选项内容"),
      }),
    )
    .optional()
    .default([])
    .describe("选择题选项（简答题可省略）"),
  correctAnswer: z.string().describe("正确答案（选择题为选项 label，简答题为参考要点）"),
});

export const DiagnosticOutput = z.object({
  questions: z.array(DiagnosticQuestion).min(3).max(5).describe("诊断题目列表"),
});

export const DiagnosticAnswer = z.object({
  questionId: z.string(),
  answer: z.string(),
});

export const DiagnosticEvaluation = z.object({
  startingNodeIndex: z.number().int().min(0).describe("建议起始节点序号"),
  reasoningText: z.string().describe("定位理由"),
  answersummary: z.array(
    z.object({
      questionId: z.string(),
      correct: z.boolean(),
      brief: z.string().describe("简短点评"),
    }),
  ),
});

/** Chat-inline diagnostic: askQuestion tool parameter schema */
export const AskQuestionParams = z.object({
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
});

export type AskQuestionParams = z.infer<typeof AskQuestionParams>;

export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestion>;
export type DiagnosticOutput = z.infer<typeof DiagnosticOutput>;
export type DiagnosticAnswer = z.infer<typeof DiagnosticAnswer>;
export type DiagnosticEvaluation = z.infer<typeof DiagnosticEvaluation>;
