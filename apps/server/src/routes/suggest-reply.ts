import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { generateText } from "ai";
import { getProvider } from "../../../worker/src/agent/provider";

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

    const result = await generateText({
      model: getProvider()("glm-5-turbo"),
      system: `你是一个苏格拉底式私教。用户正在思考你的问题，但不知道怎么回答。提供一个简短的提示或建议回复方向（不是完整答案），帮助用户找到思路。回复 1-2 句话。`,
      prompt: `当前学习主题：${topic || "未知"}
${hint ? `提示方向：${hint}` : ""}
你问的问题：${currentQuestion}

请给出一个简短的思考方向提示。`,
    });

    return c.json({ suggestion: result.text });
  },
);
