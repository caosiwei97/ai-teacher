import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { buildTutorSystemPrompt } from "./prompts/tutor.js";
import {
  assessMastery,
  generateAssessment,
  recordStrength,
  recordMisconception,
  advanceNode,
} from "./tools/index.js";

const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL:
    process.env.OPENAI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});

export interface TutorContext {
  topic: string;
  currentNode: { id: string; title: string; description: string };
  masteredNodes: string[];
  learnerProfile: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function streamTutorResponse(context: TutorContext) {
  const systemPrompt = buildTutorSystemPrompt({
    topic: context.topic,
    currentNode: context.currentNode,
    masteredNodes: context.masteredNodes.join(", ") || "无",
    learnerProfile: context.learnerProfile || "首次学习",
  });

  const result = streamText({
    model: provider("glm-4-flash"),
    system: systemPrompt,
    messages: context.messages,
    tools: {
      assessMastery,
      generateAssessment,
      recordStrength,
      recordMisconception,
      advanceNode,
    },
    maxSteps: 3,
  });

  return result;
}
