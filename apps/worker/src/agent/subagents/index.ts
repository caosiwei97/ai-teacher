import { SubagentRegistry } from "@ai-teacher/agent";
import { assessmentSubagent } from "./assessment";
import { researchSubagent } from "./research";

export function createSubagentRegistry(): SubagentRegistry {
  const registry = new SubagentRegistry();
  registry.register(assessmentSubagent).register(researchSubagent);
  return registry;
}

export { assessmentSubagent, researchSubagent };
