import type { ToolDefinition } from "../types";
import { assessMasteryTool } from "./assess-mastery";
import { generateAssessmentTool } from "./generate-assessment";
import { recordStrengthTool } from "./record-strength";
import { recordMisconceptionTool } from "./record-misconception";
import { advanceNodeTool } from "./advance-node";
import { executeCodeTool } from "./execute-code";
import { renderUITool } from "./render-ui";
import { pushCodeTool } from "./push-code";
import { askQuestionTool } from "./ask-question";
import { generateRoadmapTool } from "./generate-roadmap";
import { retrieveContextTool } from "./retrieve-context";

export const tutorToolDefinitions: ToolDefinition[] = [
  assessMasteryTool,
  generateAssessmentTool,
  recordStrengthTool,
  recordMisconceptionTool,
  advanceNodeTool,
  executeCodeTool,
  renderUITool,
  pushCodeTool,
  askQuestionTool,
  generateRoadmapTool,
  retrieveContextTool,
];
