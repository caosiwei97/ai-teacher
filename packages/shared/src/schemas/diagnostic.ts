import { z } from "zod";

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
  reasoning: z.string().describe("定位理由"),
  answersummary: z.array(
    z.object({
      questionId: z.string(),
      correct: z.boolean(),
      brief: z.string().describe("简短点评"),
    }),
  ),
});

export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestion>;
export type DiagnosticOutput = z.infer<typeof DiagnosticOutput>;
export type DiagnosticAnswer = z.infer<typeof DiagnosticAnswer>;
export type DiagnosticEvaluation = z.infer<typeof DiagnosticEvaluation>;
