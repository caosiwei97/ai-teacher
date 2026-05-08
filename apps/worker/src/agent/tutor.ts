import { streamText } from "ai";
import { buildTutorSystemPrompt } from "./prompts/tutor.js";
import { BaseAgent } from "./base-agent.js";
import { createTutorTools } from "./tools/create-tools.js";

export interface TutorContext {
  topic: string;
  currentNode: { id: string; title: string; description: string };
  allNodes: Array<{ id: string; index: number; title: string; status: string }>;
  masteredNodes: string[];
  learnerProfile: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export class TutorAgent extends BaseAgent {
  async run(context: TutorContext) {
    const systemPrompt = buildTutorSystemPrompt({
      topic: context.topic,
      currentNode: context.currentNode,
      allNodes: context.allNodes,
      masteredNodes: context.masteredNodes.join(", ") || "无",
      learnerProfile: context.learnerProfile || "首次学习",
    });

    return streamText({
      model: this.getModel(),
      system: systemPrompt,
      messages: context.messages,
      tools: createTutorTools(),
      maxSteps: 3,
    });
  }
}

export async function streamTutorResponse(context: TutorContext) {
  const agent = new TutorAgent();
  return agent.run(context);
}
