// 通用 LLM 调用重试工具（迭代 048 从 worker BaseAgent.executeWithRetry 提炼）
// 供 server/worker 共享的诊断逻辑使用，纯逻辑无 worker 依赖

const RETRYABLE_PATTERNS = [
  "rate limit",
  "429",
  "500",
  "503",
  "timeout",
  "ECONNRESET",
  "ETIMEDOUT",
];

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Error &&
    RETRYABLE_PATTERNS.some((p) => error.message.includes(p))
  );
}

/**
 * 带指数退避重试的执行器。
 * - 可重试错误（限流/5xx/超时/连接重置）按 2^attempt 秒退避后重试
 * - 不可重试错误或达上限立即抛出
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === maxRetries - 1) {
        break;
      }

      const delay = Math.pow(2, attempt) * 1000;
      console.warn(
        `[retry] ${attempt + 1}/${maxRetries} after ${delay}ms:`,
        error instanceof Error ? error.message : String(error),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
