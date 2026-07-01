import type { ModelMessage } from "ai";
import type { PromptContextBreakdown } from "@ai-teacher/shared";
import { estimateTokens } from "./context";

export interface PromptToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: unknown;
  source?: "tool" | "mcp";
}

interface EstimatePromptBreakdownOptions {
  system: string;
  messages: ModelMessage[];
  tools: PromptToolDescriptor[];
}

const BREAKDOWN_KEYS: Array<keyof PromptContextBreakdown> = [
  "system",
  "user",
  "assistant",
  "tools",
  "mcpTools",
];

function isMcpTool(name: string, source?: PromptToolDescriptor["source"]) {
  return source === "mcp" || /^(mcp__|mcp:|mcp\/)/i.test(name);
}

function stringifyForEstimate(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function estimateValue(value: unknown): number {
  return estimateTokens(stringifyForEstimate(value));
}

function addToolTokens(
  breakdown: PromptContextBreakdown,
  toolName: string,
  value: unknown,
) {
  const key = isMcpTool(toolName) ? "mcpTools" : "tools";
  breakdown[key] += estimateValue(value) + 4;
}

export function estimatePromptBreakdown({
  system,
  messages,
  tools,
}: EstimatePromptBreakdownOptions): PromptContextBreakdown {
  const breakdown: PromptContextBreakdown = {
    system: estimateValue(system) + 4,
    user: 0,
    assistant: 0,
    tools: 0,
    mcpTools: 0,
  };

  for (const tool of tools) {
    const key = isMcpTool(tool.name, tool.source) ? "mcpTools" : "tools";
    breakdown[key] +=
      estimateValue({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }) + 8;
  }

  for (const message of messages) {
    if (message.role === "system") {
      breakdown.system += estimateValue(message.content) + 4;
      continue;
    }

    if (message.role === "user") {
      breakdown.user += estimateValue(message.content) + 4;
      continue;
    }

    if (message.role === "tool") {
      for (const part of message.content) {
        if ("toolName" in part && typeof part.toolName === "string") {
          addToolTokens(breakdown, part.toolName, part);
        } else {
          breakdown.tools += estimateValue(part) + 4;
        }
      }
      continue;
    }

    if (typeof message.content === "string") {
      breakdown.assistant += estimateValue(message.content) + 4;
      continue;
    }

    let hasAssistantContent = false;
    for (const part of message.content) {
      if (
        (part.type === "tool-call" || part.type === "tool-result") &&
        "toolName" in part
      ) {
        addToolTokens(breakdown, part.toolName, part);
      } else {
        breakdown.assistant += estimateValue(part);
        hasAssistantContent = true;
      }
    }
    if (hasAssistantContent) breakdown.assistant += 4;
  }

  return breakdown;
}

export function calibratePromptBreakdown(
  estimated: PromptContextBreakdown,
  inputTokens: number,
): PromptContextBreakdown {
  const target = Math.max(0, Math.round(inputTokens));
  const estimatedTotal = BREAKDOWN_KEYS.reduce(
    (sum, key) => sum + Math.max(0, estimated[key]),
    0,
  );

  if (target === 0) {
    return { system: 0, user: 0, assistant: 0, tools: 0, mcpTools: 0 };
  }
  if (estimatedTotal === 0) {
    return { system: target, user: 0, assistant: 0, tools: 0, mcpTools: 0 };
  }

  const scaled = BREAKDOWN_KEYS.map((key) => {
    const raw = (Math.max(0, estimated[key]) / estimatedTotal) * target;
    return { key, value: Math.floor(raw), fraction: raw - Math.floor(raw) };
  });
  let remaining =
    target - scaled.reduce((sum, item) => sum + item.value, 0);

  scaled.sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; remaining > 0; index++, remaining--) {
    scaled[index % scaled.length].value += 1;
  }

  const result: PromptContextBreakdown = {
    system: 0,
    user: 0,
    assistant: 0,
    tools: 0,
    mcpTools: 0,
  };
  for (const item of scaled) result[item.key] = item.value;
  return result;
}
