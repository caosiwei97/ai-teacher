import type { CoreMessage } from "ai";

export interface MessageTransformOptions {
  maxMessages?: number;
  recentTurns?: number;
  maxCharsPerMessage?: number;
}

const DEFAULT_OPTIONS: Required<MessageTransformOptions> = {
  maxMessages: 30,
  recentTurns: 10,
  maxCharsPerMessage: 2000,
};

function truncateMessageContent(
  msg: CoreMessage,
  maxChars: number,
): CoreMessage {
  if (
    (msg.role === "user" || msg.role === "assistant") &&
    typeof msg.content === "string" &&
    msg.content.length > maxChars
  ) {
    return { ...msg, content: msg.content.slice(0, maxChars) + "…[已截断]" };
  }
  return msg;
}

export function transformMessages(
  messages: CoreMessage[],
  options?: MessageTransformOptions,
): CoreMessage[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const truncated = messages.map((msg) =>
    truncateMessageContent(msg, opts.maxCharsPerMessage),
  );

  if (truncated.length <= opts.maxMessages) {
    return truncated;
  }

  const recentMessages = truncated.slice(-opts.recentTurns * 2);
  const olderMessages = truncated.slice(0, -opts.recentTurns * 2);

  const summaryMessage: CoreMessage = {
    role: "user",
    content: `[系统：前方有 ${olderMessages.length} 条历史消息已压缩。以下是最近的对话继续。]`,
  };

  return [...olderMessages.slice(0, 2), summaryMessage, ...recentMessages];
}

export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokens += 1.5;
    } else if (/\s/.test(char)) {
      tokens += 0.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}

export function estimateMessagesTokens(messages: CoreMessage[]): number {
  return messages.reduce((total, msg) => {
    const content =
      typeof msg.content === "string" ? msg.content : "";
    return total + estimateTokens(content) + 4;
  }, 0);
}
