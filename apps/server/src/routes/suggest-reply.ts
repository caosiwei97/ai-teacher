import { Hono } from "hono";
import { z } from 'zod';
import { zValidator } from "@hono/zod-validator";
import { generateText } from "ai";
import { getFallbackProvider } from "../../../worker/src/agent/provider-registry.js";

const suggestReplySchema = z.object({
  sessionId: z.string().min(1),
  currentQuestion: z.string().min(1),
  topic: z.string().optional(),
  hint: z.string().optional(),
});

export const suggestReplyRoute = new Hono().post(
  "/",
  zValidator("json", suggestReplySchema),
  async (c) => {
    const { currentQuestion, topic, hint } = c.req.valid("json");

    if (process.env.MOCK_LLM === "true") {
      return c.json({ suggestion: "试着把它和日常生活中的例子联系起来。" });
    }

    const result = await generateText({
      model: getFallbackProvider()("deepseek-v4-flash"),
      system: `你是一个苏格拉底式私教。用户正在思考你的问题，但不知道怎么回答。提供一个简短的提示或建议回复方向（不是完整答案），帮助用户找到思路。回复 1-2 句话。`,
      prompt: `当前学习主题：${topic || "未知"}
${hint ? `提示方向：${hint}` : ""}
你问的问题：${currentQuestion}

请给出一个简短的思考方向提示。`,
    });

    return c.json({ suggestion: result.text });
  },
);
