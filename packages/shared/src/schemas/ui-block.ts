import { z } from 'zod';

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
});

export const AssessmentBlockSchema = z.object({
  type: z.literal("assessment"),
  summary: z.string(),
  reviewTable: z.array(
    z.object({
      points: z.string(),
      yourAnswer: z.string(),
      accuracy: z.string(),
    }),
  ),
  coreTags: z.array(z.string()),
  nextNodeTitle: z.string(),
});

export const QuizBlockSchema = z.object({
  type: z.literal("quiz"),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
    }),
  ),
});

export const CodeResultBlockSchema = z.object({
  type: z.literal("code-result"),
  language: z.string(),
  code: z.string(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
});

export const FormulaBlockSchema = z.object({
  type: z.literal("formula"),
  latex: z.string(),
  description: z.string(),
});

export const DiagramBlockSchema = z.object({
  type: z.literal("diagram"),
  diagramType: z.enum(["flowchart", "mindmap", "sequence"]),
  data: z.unknown(),
});

export const TableBlockSchema = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const CalloutBlockSchema = z.object({
  type: z.literal("callout"),
  variant: z.enum(["tip", "warning", "key"]),
  title: z.string().optional(),
  content: z.string(),
});

export const ComparisonCardSchema = z.object({
  type: z.literal("comparison"),
  title: z.string().optional(),
  items: z.array(
    z.object({
      label: z.string(),
      left: z.string(),
      right: z.string(),
    }),
  ),
});

export const HeadingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string(),
});

export const BadgeBlockSchema = z.object({
  type: z.literal("badge"),
  items: z.array(
    z.object({
      text: z.string(),
      variant: z.enum(["success", "warning", "info"]),
    }),
  ),
});

export const MasteryReportBlockSchema = z.object({
  type: z.literal("mastery-report"),
  nodeId: z.string(),
  nodeName: z.string(),
  score: z.number(),
  summary: z.string(),
  table: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  badges: z.array(z.string()),
});

// 迭代 050②：互动教学产物（自包含 HTML，前端 iframe 沙箱渲染）
export const InteractiveBlockSchema = z.object({
  type: z.literal("interactive"),
  html: z.string(),
});

// 迭代 051：复习抽认卡（正面问题 → 翻面答案，提取练习）
export const FlashcardBlockSchema = z.object({
  type: z.literal("flashcard"),
  nodeId: z.string(),
  front: z.string(),
  back: z.string(),
});

export const UIBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  AssessmentBlockSchema,
  QuizBlockSchema,
  CodeResultBlockSchema,
  FormulaBlockSchema,
  DiagramBlockSchema,
  TableBlockSchema,
  CalloutBlockSchema,
  ComparisonCardSchema,
  HeadingBlockSchema,
  BadgeBlockSchema,
  MasteryReportBlockSchema,
  InteractiveBlockSchema,
  FlashcardBlockSchema,
]);

export type UIBlock = z.infer<typeof UIBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type AssessmentBlock = z.infer<typeof AssessmentBlockSchema>;
export type QuizBlock = z.infer<typeof QuizBlockSchema>;
export type CodeResultBlock = z.infer<typeof CodeResultBlockSchema>;
export type FormulaBlock = z.infer<typeof FormulaBlockSchema>;
export type DiagramBlock = z.infer<typeof DiagramBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type ComparisonCardBlock = z.infer<typeof ComparisonCardSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type BadgeBlock = z.infer<typeof BadgeBlockSchema>;
export type MasteryReportBlock = z.infer<typeof MasteryReportBlockSchema>;
export type InteractiveBlock = z.infer<typeof InteractiveBlockSchema>;
export type FlashcardBlock = z.infer<typeof FlashcardBlockSchema>;

export interface UIStreamStartEvent {
  type: "ui-stream-start";
  data: Record<string, never>;
}

export interface UIBlockDeltaEvent {
  type: "ui-block-delta";
  data: { block: UIBlock; index: number };
}
