// 自定义 ESLint 规则：禁止 default export，强制命名导出
// 迭代 042 计算性传感器 —— 把 AGENTS.md §4「命名导出（不用 default export）」从 AI 自觉遵守升级为工具强制
// 错误信息含 AI 可消费的修复指令（OpenAI「a positive kind of prompt injection」理念）

export default {
  meta: {
    type: "problem",
    docs: {
      description: "禁止 default export，强制命名导出（AGENTS.md §4）",
    },
    schema: [],
    messages: {
      defaultExport:
        "禁止 default export。请改用命名导出，例：`export function Foo() {}` 或 `export const Foo = ...`。依据：AGENTS.md §4「命名导出（不用 default export）」",
    },
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "defaultExport" });
      },
    };
  },
};
