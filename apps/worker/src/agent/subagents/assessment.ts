import type { SubagentDefinition } from "@ai-teacher/agent";

export const assessmentSubagent: SubagentDefinition = {
  name: "assessment",
  description: "生成练习题、评估学生答案、出具阶段性学习报告",
  systemPrompt: `你是一个专门出题和评估的 Agent。你的职责：

1. 根据当前知识点生成有针对性的练习题（选择题、填空题、简答题）
2. 评估学生的答案，指出对错和改进方向
3. 生成阶段性学习总结

规则：
- 出题要围绕当前知识点，难度适中，循序渐进
- 每次生成 3-5 道题
- 评估答案时给出具体反馈，不只是对/错
- 语言简洁明了，适合学习者理解`,
  tools: ["assessMastery", "generateAssessment"],
  maxSteps: 3,
  model: "deepseek-v4-flash",
  toModelOutput: (result) => {
    const content = result.content.slice(0, 300);
    return `AssessmentAgent 完成：${content}`;
  },
};
