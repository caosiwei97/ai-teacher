import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { streamText } from "ai";
import { getFallbackProvider } from "../../../worker/src/agent/provider-registry.js";

const quickQuestionSchema = z.object({
  sessionId: z.string().min(1),
  selectedText: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
});

export const quickQuestionRoute = new Hono().post(
  "/",
  zValidator("json", quickQuestionSchema),
  async (c) => {
    const { selectedText, question, context } = c.req.valid("json");

    if (process.env.MOCK_LLM === "true") {
      return new Response(
        "data: {\"type\":\"start\"}\n\ndata: {\"type\":\"text\",\"content\":\"这是一个模拟回复。\"}\n\ndata: {\"type\":\"done\"}\n\n",
        { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
      );
    }

    const result = streamText({
      model: getFallbackProvider()("deepseek-v4-flash"),
      system: `你是一个1v1私教。用户选中了一段文字并提出了问题。请基于选中的内容，用苏格拉底式追问的方式回答。语言简洁，1-3句话。`,
      prompt: `选中内容：「${selectedText}」
${context ? `上下文：${context}` : ""}
用户的问题：${question}

请基于选中的内容回答。`,
    });

    return result.toUIMessageStreamResponse();
  },
);
