import { streamText, stepCountIs } from "ai";
import { buildTutorSystemPrompt } from "./prompts/tutor.js";
import { BaseAgent } from "./base-agent.js";
import { createTutorTools } from "./tools/create-tools.js";
import { transformMessages } from "./context.js";

export interface TutorContext {
  topic: string;
  currentNode: { id: string; title: string; description: string };
  allNodes: Array<{ id: string; index: number; title: string; status: string }>;
  masteredNodes: string[];
  learnerProfile: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/** @deprecated Use getTutorGraph() from ../graphs/tutor-graph instead */
export class TutorAgent extends BaseAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(context: TutorContext): Promise<any> {
    const systemPrompt = buildTutorSystemPrompt({
      topic: context.topic,
      currentNode: context.currentNode,
      allNodes: context.allNodes,
      masteredNodes: context.masteredNodes.join(", ") || "无",
      learnerProfile: context.learnerProfile || "首次学习",
    });

    const transformedMessages = transformMessages(context.messages);

    return streamText({
      model: this.getModel(),
      system: systemPrompt,
      messages: transformedMessages,
      tools: createTutorTools(),
      stopWhen: stepCountIs(3)
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function streamTutorResponse(context: TutorContext): Promise<any> {
  const agent = new TutorAgent();
  return agent.run(context);
}
