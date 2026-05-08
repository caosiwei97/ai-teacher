import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { RoadmapOutput } from "@ai-teacher/shared";
import type { RoadmapOutput as RoadmapOutputType } from "@ai-teacher/shared";

const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});

const ROADMAP_SYSTEM_PROMPT = `你是一个教学设计专家。根据学习主题，设计结构化的学习路径。

规则：
1. 每个节点是一个可独立评估的知识点
2. 节点按学习顺序排列，后面的依赖前面的
3. 节点粒度适中：太粗无法评估，太细学习节奏被打断
4. 最后一个节点应该是综合应用
5. 生成 5-15 个节点`;

export async function generateRoadmap(topic: string, sourceContent?: string): Promise<RoadmapOutputType> {
  const userPrompt = sourceContent
    ? `基于以下学习资料，为「${topic}」设计学习路线：\n\n${sourceContent.slice(0, 3000)}`
    : `为「${topic}」设计学习路线`;

  const result = await generateObject({
    model: provider("glm-4-flash"),
    schema: RoadmapOutput,
    system: ROADMAP_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}
