import type { ToolDefinition } from "@ai-teacher/agent";
import { z } from "zod";

export const renderUITool: ToolDefinition = {
  name: "renderUI",
  description: "生成结构化教学组件（表格、对比卡、提示卡），让教学内容更直观清晰",
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
        ]),
      )
      .describe("要渲染的结构化内容块列表"),
  }),
  execute: async (params) => {
    const p = params as { blocks: unknown[] };
    return { success: true, uiBlocks: p.blocks };
  },
  promptSnippet: `**renderUI 工具**：你可以在对话中生成结构化教学组件，让知识呈现更直观。支持三种类型：
- table: 表格（适合对比多个属性、罗列要点）
- callout: 提示卡（tip=提示, warning=注意事项, key=核心要点）
- comparison: 对比卡（适合两种方案的横向比较）
每次调用可以生成多个 block，它们会按顺序显示在你的回复中。`,
  promptGuidelines: [
    "讲对比类知识时（如浅拷贝vs深拷贝、同步vs异步），用 comparison 类型",
    "总结多个要点时，用 table 类型",
    "强调核心概念或常见陷阱时，用 callout 类型（variant=key 用于核心要点，variant=warning 用于常见陷阱）",
    "不要在 renderUI 中重复你已经用文字说过的内容，而是用它来补充视觉化呈现",
  ],
};
