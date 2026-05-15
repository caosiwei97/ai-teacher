import type { SubagentDefinition } from "../types";
import { assessmentSubagent } from "./assessment";
import { researchSubagent } from "./research";

export const subagentConfigs: SubagentDefinition[] = [
  assessmentSubagent,
  researchSubagent,
];

export { assessmentSubagent, researchSubagent };
