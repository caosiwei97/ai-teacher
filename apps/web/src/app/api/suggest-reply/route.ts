import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { getProvider } from "../../../../../worker/src/agent/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suggestReplySchema = z.object({
  sessionId: z.string().min(1),
  currentQuestion: z.string().min(1),
  topic: z.string().optional(),
  hint: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = suggestReplySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { currentQuestion, topic, hint } = parsed.data;

  const result = await generateText({
    model: getProvider()("glm-4-flash"),
    system: `你是一个苏格拉底式私教。用户正在思考你的问题，但不知道怎么回答。提供一个简短的提示或建议回复方向（不是完整答案），帮助用户找到思路。回复 1-2 句话。`,
    prompt: `当前学习主题：${topic || "未知"}
${hint ? `提示方向：${hint}` : ""}
你问的问题：${currentQuestion}

请给出一个简短的思考方向提示。`,
  });

  return NextResponse.json({ suggestion: result.text });
}
