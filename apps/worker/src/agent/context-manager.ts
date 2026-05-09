import type { CoreMessage } from "ai";
import type { StructuredSummary } from "@ai-teacher/shared";
import {
  type AgentMessage,
  coreMessagesToAgentMessages,
  agentMessagesToCoreMessages,
  isLlmMessage,
  isSystemEvent,
} from "./agent-message";
import { estimateTokens } from "./context";
import {
  generateCompactSummary,
  updateCompactSummary,
  formatSummaryAsContext,
} from "./compaction";

export interface ContextResult {
  messages: CoreMessage[];
  tokenCount: number;
  summary: StructuredSummary | null;
  compacted: boolean;
}

interface ContextManagerDeps {
  loadSummary: (sessionId: string) => Promise<StructuredSummary | null>;
  saveSummary: (sessionId: string, summary: StructuredSummary) => Promise<void>;
}

const DEFAULT_TOKEN_BUDGET = 6000;
const COMPACT_THRESHOLD = 0.8;
const KEEP_RECENT_TURNS = 10;
const MAX_CHARS_PER_MESSAGE = 2000;

export class ContextManager {
  private tokenBudget: number;
  private deps: ContextManagerDeps;

  constructor(deps: ContextManagerDeps, tokenBudget?: number) {
    this.deps = deps;
    this.tokenBudget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  }

  async process(
    sessionId: string,
    rawMessages: CoreMessage[],
  ): Promise<ContextResult> {
    const agentMessages = coreMessagesToAgentMessages(rawMessages);
    const transformed = this.transformContext(agentMessages);
    const tokenCount = this.estimateAgentTokens(transformed);

    if (tokenCount > this.tokenBudget * COMPACT_THRESHOLD) {
      return this.compact(sessionId, transformed);
    }

    return {
      messages: agentMessagesToCoreMessages(transformed),
      tokenCount,
      summary: null,
      compacted: false,
    };
  }

  private transformContext(messages: AgentMessage[]): AgentMessage[] {
    return messages
      .filter((m) => {
        if (isSystemEvent(m) && m.event === "checkpoint") return false;
        return true;
      })
      .map((m) => {
        if (isLlmMessage(m) && m.content.length > MAX_CHARS_PER_MESSAGE) {
          return {
            ...m,
            content: m.content.slice(0, MAX_CHARS_PER_MESSAGE) + "…[已截断]",
          };
        }
        return m;
      });
  }

  private async compact(
    sessionId: string,
    messages: AgentMessage[],
  ): Promise<ContextResult> {
    const existingSummary = await this.deps.loadSummary(sessionId);
    const recentCount = KEEP_RECENT_TURNS * 2;
    const recent = messages.slice(-recentCount);
    const toCompress = messages.slice(0, -recentCount);

    if (toCompress.length === 0) {
      return {
        messages: agentMessagesToCoreMessages(messages),
        tokenCount: this.estimateAgentTokens(messages),
        summary: existingSummary,
        compacted: false,
      };
    }

    let newSummary: StructuredSummary;
    try {
      newSummary = existingSummary
        ? await updateCompactSummary(existingSummary, toCompress)
        : await generateCompactSummary(toCompress);
    } catch (error) {
      console.error("[ContextManager] compaction failed, falling back to truncation:", error);
      const fallback = messages.slice(-recentCount);
      return {
        messages: agentMessagesToCoreMessages(fallback),
        tokenCount: this.estimateAgentTokens(fallback),
        summary: existingSummary,
        compacted: false,
      };
    }

    await this.deps.saveSummary(sessionId, newSummary);

    const summaryMessage: AgentMessage = {
      type: "llm",
      role: "assistant",
      content: formatSummaryAsContext(newSummary),
    };

    const compacted = [summaryMessage, ...recent];
    return {
      messages: agentMessagesToCoreMessages(compacted),
      tokenCount: this.estimateAgentTokens(compacted),
      summary: newSummary,
      compacted: true,
    };
  }

  private estimateAgentTokens(messages: AgentMessage[]): number {
    return messages.reduce((sum, m) => {
      if (isLlmMessage(m)) {
        return sum + estimateTokens(m.content) + 4;
      }
      return sum + 20;
    }, 0);
  }
}
