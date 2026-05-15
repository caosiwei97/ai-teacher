import type { ToolDefinition } from "../types";
import { z } from "zod";

export const pushCodeTool: ToolDefinition = {
  name: "pushCode",
  description:
    "推送代码到右侧编辑器面板，学生可以直接修改运行。适合在教学过程中给出代码示例、练习模板或代码片段让学生动手实验。",
  inputSchema: z.object({
    code: z.string().describe("代码内容"),
    language: z
      .enum(["python", "javascript", "typescript", "java", "cpp"])
      .describe("编程语言"),
    instruction: z
      .string()
      .optional()
      .describe("给学生的操作说明，如'试试修改这里的条件看看输出变化'"),
  }),
  execute: async (params) => {
    const p = params as { code: string; language: string; instruction?: string };
    return { success: true, code: p.code, language: p.language, instruction: p.instruction };
  },
  promptSnippet: `**pushCode 工具**：你可以将代码推送到学生的右侧编辑器面板，学生可以直接修改并运行。适合在讲解代码相关知识点时使用。`,
  promptGuidelines: [
    "讲完概念后给出可动手的代码示例时用 pushCode",
    "instruction 应引导学生修改代码的关键部分，而不是照抄",
    "推送到编辑器的代码应是完整可运行的",
  ],
};
