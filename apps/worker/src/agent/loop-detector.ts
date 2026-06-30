// 循环检测：哈希指纹 + ping-pong + 全局熔断
// 只读工具（retrieve-context 等）放宽阈值，避免误杀合法分页/重试

export interface LoopDetection {
  type: "hash-loop" | "ping-pong" | "circuit-break";
  toolName: string;
}

interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

// 可重复调用的只读工具白名单（放宽到连续 5 次才报）
const READONLY_WHITELIST = new Set(["retrieve-context", "search"]);

function fingerprint(call: ToolCall): string {
  // 归一化：排序 args key，忽略分页 offset/limit
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(call.args).sort()) {
    if (k === "offset" || k === "limit" || k === "page") continue;
    normalized[k] = call.args[k];
  }
  return `${call.toolName}:${JSON.stringify(normalized)}`;
}

export class LoopDetector {
  private recent: string[] = []; // 最近 4 步指纹，用于 ping-pong 检测
  private lastFp: string | null = null;
  private runLength = 0;
  private corrections = 0;

  check(call: ToolCall): LoopDetection | null {
    const fp = fingerprint(call);
    this.recent.push(fp);
    if (this.recent.length > 4) this.recent.shift();

    const isReadonly = READONLY_WHITELIST.has(call.toolName);

    // hash-loop：相同指纹连续出现（与 ping-pong 窗口解耦，避免窗口截断漏报）
    const threshold = isReadonly ? 5 : 2;
    if (fp === this.lastFp) this.runLength++;
    else {
      this.lastFp = fp;
      this.runLength = 1;
    }
    if (this.runLength >= threshold) {
      return { type: "hash-loop", toolName: call.toolName };
    }

    // ping-pong：X-Y-X-Y（仅对非白名单工具）
    if (!isReadonly && this.recent.length === 4) {
      const [a, b, c, d] = this.recent;
      if (a === c && b === d && a !== b) {
        return { type: "ping-pong", toolName: call.toolName };
      }
    }
    return null;
  }

  recordCorrection(): void {
    this.corrections++;
  }

  shouldCircuitBreak(): boolean {
    return this.corrections >= 3;
  }
}
