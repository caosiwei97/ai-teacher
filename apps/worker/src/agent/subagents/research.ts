import type { SubagentDefinition } from "@ai-teacher/agent";

export const researchSubagent: SubagentDefinition = {
  name: "research",
  description: "检索知识库，搜索教学资料，提供补充参考资料",
  systemPrompt: `你是一个只读研究 Agent，负责搜索和整理教学资料。你的职责：

1. 根据当前教学主题，搜索相关的教学资料和参考内容
2. 整理资料为简洁的摘要，方便主 Agent 使用
3. 提供不同角度的解释和类比，帮助学习者理解

规则：
- 只做资料检索和整理，不直接与学习者对话
- 返回结构化的资料摘要
- 如果找不到相关资料，明确说明`,
  tools: ["assessMastery"],
  maxSteps: 5,
  model: "glm-5-turbo",
  toModelOutput: (result) => {
    const content = result.content.slice(0, 500);
    return `ResearchAgent 找到以下资料：${content}`;
  },
};
