import { NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { getProvider } from "../../../../../worker/src/agent/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const quickQuestionSchema = z.object({
  sessionId: z.string().min(1),
  selectedText: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = quickQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { selectedText, question, context } = parsed.data;

  const result = streamText({
    model: getProvider()("glm-4-flash"),
    system: `你是一个1v1私教。用户选中了一段文字并提出了问题。请基于选中的内容，用苏格拉底式追问的方式回答。语言简洁，1-3句话。`,
    prompt: `选中内容：「${selectedText}」
${context ? `上下文：${context}` : ""}
用户的问题：${question}

请基于选中的内容回答。`,
  });

  return result.toDataStreamResponse();
}
