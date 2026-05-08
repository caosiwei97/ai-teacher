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

  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries?: number,
  ): Promise<T> {
    const maxRetries = retries ?? this.config.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isRetryable =
          error instanceof Error &&
          (error.message.includes("rate limit") ||
            error.message.includes("429") ||
            error.message.includes("500") ||
            error.message.includes("503") ||
            error.message.includes("timeout") ||
            error.message.includes("ECONNRESET") ||
            error.message.includes("ETIMEDOUT"));

        if (!isRetryable || attempt === maxRetries - 1) {
          break;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `[Agent] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`,
          error instanceof Error ? error.message : String(error),
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  protected async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.executeWithRetry(primaryFn);
    } catch (primaryError) {
      console.warn(
        "[Agent] Primary model failed, trying fallback:",
        primaryError instanceof Error ? primaryError.message : String(primaryError),
      );
      try {
        return await this.executeWithRetry(fallbackFn, 1);
      } catch (fallbackError) {
        console.error("[Agent] Fallback model also failed:", fallbackError);
        throw primaryError;
      }
    }
  }

  abstract run(input: unknown): Promise<unknown>;
}
