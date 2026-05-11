import { generateObject, type LanguageModel } from "ai";
import { StructuredSummarySchema, type StructuredSummary } from "@ai-teacher/shared";
import { getProvider } from "./provider";
import type { AgentMessage } from "./agent-message";
import { isLlmMessage } from "./agent-message";

function formatMessagesForPrompt(messages: AgentMessage[]): string {
  return messages
    .filter(isLlmMessage)
    .map((m) => `${m.role === "user" ? "学生" : "导师"}: ${m.content}`)
    .join("\n\n");
}

const COMPACT_SYSTEM = `你是一个教学对话分析专家。请从以下对话中提取结构化摘要。

要求：
- completedTopics: 学生已经掌握或讨论完成的知识点
- masteryState: 每个知识点的掌握状态和最后评估时间
- misconceptions: 学生表现出的误解或薄弱点
- learningPreferences: 学生的学习偏好（解释风格、节奏）
- keyDecisions: 教学过程中的关键决策（如跳过某节点、调整难度）

只输出 JSON，不要解释。`;

const UPDATE_SYSTEM = `你是一个教学对话分析专家。请基于已有摘要和新对话，更新结构化摘要。

规则：
- 合并新旧 completedTopics（去重）
- 更新 masteryState（新评估覆盖旧评估）
- 追加新的 misconceptions（去重）
- 更新 learningPreferences（以最新行为为准）
- 追加新的 keyDecisions

只输出 JSON，不要解释。`;

export async function generateCompactSummary(
  messages: AgentMessage[],
  model?: LanguageModel,
): Promise<StructuredSummary> {
  const resolvedModel = model ?? getProvider()("deepseek-v4-flash");
  const conversation = formatMessagesForPrompt(messages);

  const { object } = await generateObject({
    model: resolvedModel,
    schema: StructuredSummarySchema,
    system: COMPACT_SYSTEM,
    prompt: conversation,
  });

  return object;
}

export async function updateCompactSummary(
  existingSummary: StructuredSummary,
  newMessages: AgentMessage[],
  model?: LanguageModel,
): Promise<StructuredSummary> {
  const resolvedModel = model ?? getProvider()("deepseek-v4-flash");
  const conversation = formatMessagesForPrompt(newMessages);

  const { object } = await generateObject({
    model: resolvedModel,
    schema: StructuredSummarySchema,
    system: UPDATE_SYSTEM,
    prompt: `已有摘要：\n${JSON.stringify(existingSummary, null, 2)}\n\n新对话：\n${conversation}`,
  });

  return object;
}

export function formatSummaryAsContext(summary: StructuredSummary): string {
  const parts: string[] = [];

  if (summary.completedTopics.length > 0) {
    parts.push(`已完成知识点：${summary.completedTopics.join("、")}`);
  }

  const misconceptions = summary.misconceptions.filter(Boolean);
  if (misconceptions.length > 0) {
    parts.push(`学生常见误解：${misconceptions.join("；")}`);
  }

  if (summary.learningPreferences) {
    parts.push(
      `学习偏好：${summary.learningPreferences.preferredExplanationStyle}，节奏${summary.learningPreferences.pacePreference === "fast" ? "快" : summary.learningPreferences.pacePreference === "slow" ? "慢" : "适中"}`,
    );
  }

  if (summary.keyDecisions.length > 0) {
    parts.push(`关键决策：${summary.keyDecisions.join("；")}`);
  }

  return `[对话历史摘要]\n${parts.join("\n")}`;
}
