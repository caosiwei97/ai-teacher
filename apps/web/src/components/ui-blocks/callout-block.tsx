"use client";

import type { CalloutBlock as CalloutBlockType } from "@ai-teacher/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";

interface CalloutBlockProps {
  block: CalloutBlockType;
}

const VARIANT_STYLES: Record<CalloutBlockType["variant"], string> = {
  tip: "border-l-roadmap-mastered bg-roadmap-mastered/5",
  warning: "border-l-accent bg-accent/5",
  key: "border-l-primary bg-primary/5",
};

function renderInlineCode(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CalloutBlock({ block }: CalloutBlockProps) {
  const variantStyle = VARIANT_STYLES[block.variant];

  return (
    <div className={`rounded-lg border-l-4 p-4 ${variantStyle}`}>
      {block.title && (
        <p className="mb-1 text-sm font-bold text-foreground truncate">
          {renderInlineCode(block.title)}
        </p>
      )}
      <div className="text-sm leading-relaxed text-foreground/90 prose-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const codeString = String(children).replace(/\n$/, "");
              if (match) {
                return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
              }
              return (
                <code className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent" {...props}>
                  {children}
                </code>
              );
            },
            pre({ children }) { return <>{children}</>; },
            p({ children }) { return <p className="mb-1 last:mb-0">{children}</p>; },
          }}
        >
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
