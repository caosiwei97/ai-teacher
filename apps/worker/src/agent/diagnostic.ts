import { generateObject } from "ai";
import {
  DiagnosticOutput,
  DiagnosticEvaluation,
} from "@ai-teacher/shared";
import type {
  DiagnosticOutput as DiagnosticOutputType,
  DiagnosticEvaluation as DiagnosticEvaluationType,
  DiagnosticAnswer,
} from "@ai-teacher/shared";
import { BaseAgent } from "./base-agent.js";

const DIAGNOSTIC_QUESTION_PROMPT = `你是一个教学诊断专家。根据学习主题和知识图谱，生成诊断摸底题目。

规则：
1. 生成 3-5 道混合题目（选择题 + 简答题），覆盖不同难度和知识节点
2. 选择题提供 4 个选项（A/B/C/D），包含一个正确答案和典型错误答案
3. 简答题要求用 1-2 句话回答核心概念
4. 题目按从易到难排列，覆盖知识图谱中前面、中间和后面的节点
5. 每道题标注对应的节点序号
6. 题目语言自然，像私教和学生聊天一样`;

const DIAGNOSTIC_EVALUATE_PROMPT = `你是一个教学诊断专家。根据学生的诊断答题情况，判断学生的起始水平。

规则：
1. 综合所有答案，判断学生应该从哪个节点开始学习
2. 如果学生基础很好（大部分答对），起始节点可以跳过前面的基础节点
3. 如果学生基础薄弱，从第 0 个节点开始
4. 给出简短的定位理由
5. 对每道题给出简短点评（正确/错误 + 一句话说明）`;

interface DiagnosticQuestionInput {
  topic: string;
  nodes: Array<{ index: number; title: string; description: string }>;
}

interface DiagnosticEvaluateInput {
  topic: string;
  nodes: Array<{ index: number; title: string; description: string }>;
  questions: Array<{
    id: string;
    question: string;
    type: string;
    correctAnswer: string;
    nodeIndex: number;
  }>;
  answers: DiagnosticAnswer[];
}

export class DiagnosticQuestionAgent extends BaseAgent {
  async run(input: DiagnosticQuestionInput): Promise<DiagnosticOutputType> {
    const nodesSummary = input.nodes
      .map((n) => `[${n.index}] ${n.title}: ${n.description}`)
      .join("\n");

    const result = await generateObject({
      model: this.getModel(),
      schema: DiagnosticOutput,
      system: DIAGNOSTIC_QUESTION_PROMPT,
      prompt: `学习主题：${input.topic}\n\n知识图谱节点：\n${nodesSummary}`,
    });

    return result.object;
  }
}

export class DiagnosticEvaluateAgent extends BaseAgent {
  async run(input: DiagnosticEvaluateInput): Promise<DiagnosticEvaluationType> {
    const nodesSummary = input.nodes
      .map((n) => `[${n.index}] ${n.title}: ${n.description}`)
      .join("\n");

    const qaList = input.questions
      .map((q) => {
        const answer = input.answers.find((a) => a.questionId === q.id);
        return `题目 ${q.id}（对应节点 ${q.nodeIndex}）: ${q.question}\n正确答案: ${q.correctAnswer}\n学生回答: ${answer?.answer ?? "未回答"}`;
      })
      .join("\n\n");

    const result = await generateObject({
      model: this.getModel(),
      schema: DiagnosticEvaluation,
      system: DIAGNOSTIC_EVALUATE_PROMPT,
      prompt: `学习主题：${input.topic}\n\n知识图谱节点：\n${nodesSummary}\n\n答题情况：\n${qaList}`,
    });

    return result.object;
  }
}

export async function generateDiagnosticQuestions(
  topic: string,
  nodes: Array<{ index: number; title: string; description: string }>,
): Promise<DiagnosticOutputType> {
  const agent = new DiagnosticQuestionAgent();
  return agent.run({ topic, nodes });
}

export async function evaluateDiagnosticAnswers(
  topic: string,
  nodes: Array<{ index: number; title: string; description: string }>,
  questions: Array<{
    id: string;
    question: string;
    type: string;
    correctAnswer: string;
    nodeIndex: number;
  }>,
  answers: DiagnosticAnswer[],
): Promise<DiagnosticEvaluationType> {
  const agent = new DiagnosticEvaluateAgent();
  return agent.run({ topic, nodes, questions, answers });
}
