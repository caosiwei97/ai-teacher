import type { ToolDefinition } from "../types";
import { z } from "zod";
import { embedTexts } from "@ai-teacher/shared/services/embedding";
import { retrieveChunks } from "@ai-teacher/shared/services/retrieval";

// 迭代 009：retrieve-context 工具——Agent 按需检索用户上传资料中的相关片段（RAG）。

export const retrieveContextTool: ToolDefinition = {
  name: "retrieveContext",
  description: "检索用户上传的学习资料中与当前问题相关的片段（基于语义相似度）",
  inputSchema: z.object({
    query: z.string().min(1).describe("检索查询，通常是学习者的问题或当前讨论的知识点"),
  }),
  execute: async (params, ctx) => {
    const { query } = params as { query: string };

    const [queryVec] = await embedTexts([query]);
    const chunks = await retrieveChunks(queryVec, ctx.userId, 5);

    return {
      success: true,
      count: chunks.length,
      chunks: chunks.map((c) => ({
        content: c.content,
        source: c.sourceTitle,
        score: Number(c.score.toFixed(3)),
      })),
      instruction:
        chunks.length === 0
          ? "未检索到相关资料片段。基于已有知识回答；若问题明显依赖外部资料，可提示学习者上传相关材料。"
          : `已检索到 ${chunks.length} 条相关资料片段（按相关性降序）。请在回答中参考这些内容辅助教学，必要时引用来源。`,
    };
  },
  promptSnippet: `**retrieveContext 工具**：检索学习者上传的学习资料。当学习者的问题、上传的资料、或当前知识点需要查阅具体资料内容时调用，传入 query（问题或知识点）。返回相关片段（按语义相似度降序），用于基于资料内容教学。`,
  promptGuidelines: [
    "学习者上传了资料后，首次涉及资料内容的问题时主动调用一次检索",
    "不要每轮都调用——仅在需要查阅资料具体内容时使用",
    "检索结果为空时，不要编造资料内容，基于已有知识回答",
  ],
};
