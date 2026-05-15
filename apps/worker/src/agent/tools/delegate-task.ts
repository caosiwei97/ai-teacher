import { streamText, stepCountIs, tool as aiTool, type LanguageModel } from "ai";
import type { Tool } from "ai";
import { z } from "zod";
import type { ToolDefinition, SubagentDefinition, AgentResult } from "../types";
import { getProvider } from "../provider";

export function createDelegateTaskTool(
  subagents: SubagentDefinition[],
  toolLookup: {
    get: (name: string) => ToolDefinition | undefined;
    getAll: () => ToolDefinition[];
  },
  providerFn?: (modelId: string) => LanguageModel,
): ToolDefinition {
  const agentDescriptions = subagents
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");

  return {
    name: "delegateTask",
    description:
      "将任务委派给专业子 Agent 执行，可选子 Agent：assessment（出题评估）、research（资料检索）",
    inputSchema: z.object({
      agent: z.string().describe("子 Agent 名称（assessment 或 research）"),
      task: z.string().describe("任务描述，子 Agent 会独立执行"),
    }),
    execute: async (params) => {
      const p = params as { agent: string; task: string };

      const agentDef = subagents.find((a) => a.name === p.agent);
      if (!agentDef) {
        return {
          success: false,
          error: `未知的子 Agent：${p.agent}。可选：${agentDescriptions}`,
        };
      }

      const subTools: Record<string, Tool> = {};
      for (const toolName of agentDef.tools) {
        const def = toolLookup.get(toolName);
        if (def) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          subTools[toolName] = aiTool({
            description: def.description,
            inputSchema: def.inputSchema as any,
            execute: async (toolParams: Record<string, unknown>) => {
              return def.execute(toolParams, {
                prisma: null,
                sessionId: "",
                userId: "",
              });
            },
          });
        }
      }

      try {
        const model = (providerFn ?? getProvider())(
          agentDef.model ?? "deepseek-v4-flash",
        );
        const result = streamText({
          model,
          system: agentDef.systemPrompt,
          prompt: p.task,
          tools: subTools,
          stopWhen: stepCountIs(agentDef.maxSteps),
        });

        const fullText = await result.text;

        const agentResult: AgentResult = {
          content: fullText,
          steps: 0,
          toolCalls: [],
        };

        const summary = agentDef.toModelOutput(agentResult);

        return {
          success: true,
          content: summary,
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "子 Agent 执行失败",
        };
      }
    },
    promptSnippet: `**delegateTask 工具**：你可以委派任务给专业子 Agent：
${agentDescriptions}

委派后你会收到子 Agent 的执行摘要，不会看到完整过程。适合用于：出练习题、评估答案、检索教学资料等。`,
    promptGuidelines: [
      "当你需要出练习题或评估学生时，委派给 assessment Agent",
      "当你需要补充教学资料时，委派给 research Agent",
      "委派的 task 参数要清晰具体，描述你期望子 Agent 完成什么",
      "不要频繁委派，只在确实需要专业处理时使用",
    ],
  };
}
