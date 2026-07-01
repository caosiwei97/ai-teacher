import type { InteractiveBlock } from "@ai-teacher/shared";

export interface FallbackInteractiveNode {
  id: string;
  title: string;
  description?: string | null;
}

export interface ToolResultEntry {
  toolName: string;
  result: unknown;
}

export function createFallbackInteractiveBlock(
  node: FallbackInteractiveNode,
): InteractiveBlock {
  const title = node.title.trim() || "当前知识点";
  const description =
    node.description?.trim() ||
    `围绕「${title}」理解核心概念，并能解释它在真实场景中的作用。`;

  return {
    type: "interactive",
    nodeId: node.id,
    title: `${title} · 快速自测`,
    concept: description,
    explore: [
      {
        kind: "choice",
        label: `学习「${title}」时，先抓住哪个关键点？`,
        options: [
          { id: "a", text: "它解决什么问题，以及会怎样影响实际决策" },
          { id: "b", text: "只记住这个名词本身" },
          { id: "c", text: "先跳过概念，直接记一个结论" },
        ],
        allowMultiple: false,
      },
    ],
    quiz: {
      question: `关于「${title}」，最能说明你理解到位的是？`,
      options: [
        {
          id: "a",
          text: "能说清核心含义，并把它放到实际场景中判断",
        },
        { id: "b", text: "只知道这个词听起来很重要" },
        { id: "c", text: "完全依赖老师给标准答案" },
        { id: "d", text: "跳过它也不影响后续学习" },
      ],
      correctId: "a",
      explanation: `掌握「${title}」不只是记住定义，而是能说清它的作用，并用它辅助实际判断。`,
    },
  };
}

export function toolResultsHaveInteractiveBlock(
  toolResults: ToolResultEntry[],
): boolean {
  return toolResults.some((entry) => resultHasInteractiveBlock(entry.result));
}

function resultHasInteractiveBlock(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;

  const blocks = (result as { uiBlocks?: unknown }).uiBlocks;
  if (!Array.isArray(blocks)) return false;

  return blocks.some((block) => {
    return (
      block != null &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "interactive"
    );
  });
}
