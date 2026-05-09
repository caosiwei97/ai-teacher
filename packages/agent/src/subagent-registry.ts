import type { SubagentDefinition } from "./types";

export class SubagentRegistry {
  private agents = new Map<string, SubagentDefinition>();

  register(def: SubagentDefinition): this {
    this.agents.set(def.name, def);
    return this;
  }

  get(name: string): SubagentDefinition | undefined {
    return this.agents.get(name);
  }

  has(name: string): boolean {
    return this.agents.has(name);
  }

  getAll(): SubagentDefinition[] {
    return Array.from(this.agents.values());
  }

  getAgentDescriptions(): string {
    return Array.from(this.agents.values())
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n");
  }
}
