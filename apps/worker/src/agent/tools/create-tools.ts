import { tool } from "ai";
import { z } from 'zod';
import { ToolRegistry, type SubagentRegistry } from "@ai-teacher/agent";
import { NodeService } from "../services/node-service.js";
import { assessMasteryTool } from "./assess-mastery";
import { generateAssessmentTool } from "./generate-assessment";
import { recordStrengthTool } from "./record-strength";
import { recordMisconceptionTool } from "./record-misconception";
import { advanceNodeTool } from "./advance-node";
import { executeCodeTool } from "./execute-code";
import { createDelegateTaskTool } from "./delegate-task";

export const tutorToolDefinitions = [
  assessMasteryTool,
  generateAssessmentTool,
  recordStrengthTool,
  recordMisconceptionTool,
  advanceNodeTool,
  executeCodeTool,
];

export function createTutorToolRegistry(
  subagentRegistry?: SubagentRegistry,
): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(tutorToolDefinitions);

  if (subagentRegistry) {
    const delegateTaskTool = createDelegateTaskTool(subagentRegistry, registry);
    registry.register(delegateTaskTool);
  }

  return registry;
}

/** @deprecated Use createTutorToolRegistry().toAiSdkTools(ctx) instead */
export function createTutorTools() {
  return {
    assessMastery: tool({
      description: "评估学习者对当前知识点的掌握程度",
      inputSchema: z.object({
        conceptId: z.string().describe("知识点 ID"),
        score: z.number().min(0).max(100).describe("掌握度分数"),
        strengths: z.array(z.string()).describe("展示的理解亮点"),
        gaps: z.array(z.string()).describe("盲区"),
        misconceptions: z
          .array(
            z.object({
              belief: z.string().describe("错误认知"),
              rootCause: z.string().describe("根因"),
              resolved: z.boolean().describe("是否已纠正"),
            }),
          )
          .describe("误解列表"),
      }),
      execute: async (params) => {
        try {
          await NodeService.updateMastery(params.conceptId, params.score, params);
        } catch (e) {
          console.error("[assessMastery] DB error:", e);
        }
        return { success: true, ...params };
      },
    }),

    generateAssessment: tool({
      description: "节点掌握后生成评估总结卡片",
      inputSchema: z.object({
        conceptId: z.string().describe("知识点 ID"),
        summary: z.string().describe("总结性评价"),
        reviewTable: z
          .array(
            z.object({
              points: z.string().describe("要点"),
              yourAnswer: z.string().describe("用户回答"),
              accuracy: z.string().describe("准确度"),
            }),
          )
          .describe("回顾表格"),
        coreTags: z.array(z.string()).describe("核心要点标签"),
        nextNodeTitle: z.string().describe("下一节标题"),
      }),
      execute: async (params) => {
        return { success: true, ...params };
      },
    }),

    recordStrength: tool({
      description: "记录学习者在当前知识点上的擅长项",
      inputSchema: z.object({
        area: z.string().describe("擅长领域"),
        evidence: z.string().describe("证据"),
      }),
      execute: async (params) => {
        return { success: true, ...params };
      },
    }),

    recordMisconception: tool({
      description: "记录学习者的误解与根因",
      inputSchema: z.object({
        area: z.string().describe("误解领域"),
        misconception: z.string().describe("错误认知"),
        rootCause: z.string().describe("误解根因"),
      }),
      execute: async (params) => {
        return { success: true, ...params };
      },
    }),

    advanceNode: tool({
      description: "推进到下一个知识点",
      inputSchema: z.object({
        currentNodeId: z.string().describe("当前知识点 ID"),
        nextNodeId: z.string().describe("下一个知识点 ID"),
        masteryScore: z.number().describe("当前节点掌握度"),
      }),
      execute: async (params) => {
        try {
          await NodeService.advanceNode(
            params.currentNodeId,
            params.nextNodeId,
            params.masteryScore,
          );
        } catch (e) {
          console.error("[advanceNode] DB error:", e);
        }
        return { success: true, ...params };
      },
    }),
  };
}
