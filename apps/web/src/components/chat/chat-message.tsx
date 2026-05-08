"use client";

import { CodeBlock } from "./code-block";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

function parseContent(text: string) {
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[2].trim(), language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

function renderText(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-gray-200 px-1.5 py-0.5 text-sm font-mono text-pink-600">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";
  const parsed = parseContent(content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? "order-1" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-blue-600 text-white"
              : "rounded-bl-sm bg-gray-100 text-gray-900"
          }`}
        >
          {parsed.map((part, i) =>
            part.type === "code" ? (
              <CodeBlock key={i} language={part.language}>{part.content}</CodeBlock>
            ) : (
              <p key={i} className="whitespace-pre-wrap">
                {renderText(part.content)}
              </p>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
