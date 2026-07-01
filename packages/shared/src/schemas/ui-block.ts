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

// 互动教学产物（结构化 A2UI，三段式：概念 / 动手感受 / 自测）
// 迭代 050② 初版用 LLM 手写整段 HTML + iframe 沙箱渲染；改为结构化以降低生成成本、
// 让布局前端可控、消除 iframe postMessage 提交竞态（见 ADR）。
export const InteractiveExploreItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("slider"),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().default(1),
    initial: z.number(),
    unit: z.string().optional(),
  }),
  z.object({
    kind: z.literal("input"),
    label: z.string(),
    placeholder: z.string().optional(),
  }),
  z.object({
    kind: z.literal("choice"),
    label: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
    allowMultiple: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("matching"),
    label: z.string(),
    leftItems: z.array(z.object({ id: z.string(), text: z.string() })),
    rightItems: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  z.object({
    kind: z.literal("ordering"),
    label: z.string(),
    items: z.array(z.object({ id: z.string(), text: z.string() })),
  }),
  z.object({
    kind: z.literal("fill-blank"),
    label: z.string(),
    template: z.string(),
  }),
  z.object({
    kind: z.literal("chart-slider"),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().default(1),
    initial: z.number(),
    chartType: z.enum(["line", "bar"]).default("line"),
    formula: z.string().optional(),
  }),
]);

export const InteractiveBlockSchema = z.object({
  type: z.literal("interactive"),
  nodeId: z.string().optional(),
  title: z.string(),
  concept: z.string(),
  explore: z.array(InteractiveExploreItemSchema).default([]),
  quiz: z.object({
    question: z.string(),
    options: z.array(z.object({ id: z.string(), text: z.string() })),
    correctId: z.string(),
    explanation: z.string(),
  }),
});

// 迭代 051：复习抽认卡（正面问题 → 翻面答案，提取练习）
export const FlashcardBlockSchema = z.object({
  type: z.literal("flashcard"),
  nodeId: z.string(),
  front: z.string(),
  back: z.string(),
});

// 迭代 052：面试评分卡（复盘产物，spec §4.1 复盘）
export const InterviewScoreBlockSchema = z.object({
  type: z.literal("interviewScore"),
  totalScore: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  weakPoints: z.array(z.string()),
  improvement: z.string(),
  questionCount: z.number(),
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
  InterviewScoreBlockSchema,
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
export type InteractiveExploreItem = z.infer<typeof InteractiveExploreItemSchema>;
export type FlashcardBlock = z.infer<typeof FlashcardBlockSchema>;
export type InterviewScoreBlock = z.infer<typeof InterviewScoreBlockSchema>;

export interface UIStreamStartEvent {
  type: "ui-stream-start";
  data: Record<string, never>;
}

export interface UIBlockDeltaEvent {
  type: "ui-block-delta";
  data: { block: UIBlock; index: number };
}
