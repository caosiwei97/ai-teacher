import type { ToolDefinition } from "../types";
import { z } from "zod";

export const renderUITool: ToolDefinition = {
  name: "renderUI",
  description: "生成结构化教学组件（表格、对比卡、提示卡、互动产物），让教学内容更直观清晰",
  inputSchema: z.object({
    blocks: z
      .array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("table"),
            title: z.string().optional(),
            headers: z.array(z.string()),
            rows: z.array(z.array(z.string())),
          }),
          z.object({
            type: z.literal("callout"),
            variant: z.enum(["tip", "warning", "key"]),
            title: z.string().optional(),
            content: z.string(),
          }),
          z.object({
            type: z.literal("comparison"),
            title: z.string().optional(),
            items: z.array(
              z.object({
                label: z.string(),
                left: z.string(),
                right: z.string(),
              }),
            ),
          }),
          z.object({
            type: z.literal("heading"),
            level: z.union([z.literal(2), z.literal(3)]),
            text: z.string(),
          }),
          z.object({
            type: z.literal("badge"),
            items: z.array(
              z.object({
                text: z.string(),
                variant: z.enum(["success", "warning", "info"]),
              }),
            ),
          }),
          z.object({
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
          }),
          z.object({
            type: z.literal("interactive"),
            html: z.string(),
          }),
          z.object({
            type: z.literal("flashcard"),
            nodeId: z.string(),
            front: z.string(),
            back: z.string(),
          }),
        ]),
      )
      .describe("要渲染的结构化内容块列表"),
  }),
  execute: async (params) => {
    const p = params as { blocks: unknown[] };
    return { success: true, uiBlocks: p.blocks };
  },
  promptSnippet: `**renderUI 工具**：你可以在对话中生成结构化教学组件，让知识呈现更直观。支持七种类型：
- table: 表格（适合对比多个属性、罗列要点）
- callout: 提示卡（tip=提示, warning=注意事项, key=核心要点）
- comparison: 对比卡（适合两种方案的横向比较）
- heading: 标题（level 2 或 3，用于分隔内容段落）
- badge: 徽章标签（success=已掌握, warning=需注意, info=信息，适合展示关键要点）
- mastery-report: 掌握总结报告（节点掌握后展示总结表格和核心徽章）
- interactive: 互动教学产物（自包含 HTML，iframe 沙箱渲染，用户可交互操作；用于让概念可看可练）
- flashcard: 复习抽认卡（正面问题 front → 翻面答案 back，需带 nodeId；复习模式提取练习用）
每次调用可以生成多个 block，它们会按顺序显示在你的回复中。`,
  promptGuidelines: [
    "讲对比类知识时（如浅拷贝vs深拷贝、同步vs异步），用 comparison 类型",
    "总结多个要点时，用 table 类型",
    "强调核心概念或常见陷阱时，用 callout 类型（variant=key 用于核心要点，variant=warning 用于常见陷阱）",
    "不要在 renderUI 中重复你已经用文字说过的内容，而是用它来补充视觉化呈现",
  ],
};
