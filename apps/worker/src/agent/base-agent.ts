import { getProvider } from "./provider.js";

export interface AgentConfig {
  model?: string;
  maxRetries?: number;
  fallbackModel?: string;
}

export abstract class BaseAgent {
  protected config: Required<AgentConfig>;

  constructor(config?: AgentConfig) {
    this.config = {
      model: config?.model ?? "glm-4-flash",
      maxRetries: config?.maxRetries ?? 3,
      fallbackModel: config?.fallbackModel ?? "glm-4-flash",
    };
  }

  protected getModel() {
    return getProvider()(this.config.model);
  }

  protected getFallbackModel() {
    return getProvider()(this.config.fallbackModel);
  }
}
