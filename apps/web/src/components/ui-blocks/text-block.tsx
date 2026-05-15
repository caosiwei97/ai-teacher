
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/code-block";

interface TextBlockProps {
  block: { type: "text"; content: string };
}

/**
 * Close unclosed markdown tokens that cause rendering artifacts during streaming.
 * Handles: ``` code fences, ** bold, * italic, ` inline code
 */
function closeUnclosedMarkdown(text: string): string {
  let result = text;

  // Close unclosed code fences (```)
  const fenceCount = (result.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    result += "\n```";
  }

  // Close unclosed inline code (`)
  // Only count backticks NOT part of code fences
  const withoutFences = result.replace(/```[\s\S]*?```/g, "");
  const backtickCount = (withoutFences.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    result += "`";
  }

  // Close unclosed bold (**)
  const withoutCode = result.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  const boldCount = (withoutCode.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    result += "**";
  }

  // Close unclosed italic (single * not part of **)
  const withoutBold = withoutCode.replace(/\*\*/g, "");
  const italicCount = (withoutBold.match(/\*/g) || []).length;
  if (italicCount % 2 !== 0) {
    result += "*";
  }

  return result;
}

export function TextBlock({ block }: TextBlockProps) {
  const sanitizedContent = closeUnclosedMarkdown(block.content);

  return (
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
            <code
              className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[13px] font-mono text-code-accent"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="mb-2 border-l-3 border-accent/40 pl-3 text-muted-foreground italic last:mb-0">
              {children}
            </blockquote>
          );
        },
        h1({ children }) {
          return <h1 className="mb-2 mt-3 text-lg font-bold first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1.5 mt-2 text-sm font-bold first:mt-0">{children}</h3>;
        },
        hr() {
          return <hr className="my-3 border-border" />;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              className="text-accent underline underline-offset-2 hover:text-accent/80"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="my-2 overflow-x-auto rounded-lg border border-code-border">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-code-bg">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="border-b border-code-border px-3 py-1.5 text-left font-semibold text-code-lang">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border-b border-code-border px-3 py-1.5">
              {children}
            </td>
          );
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        em({ children }) {
          return <em>{children}</em>;
        },
      }}
    >
      {sanitizedContent}
    </ReactMarkdown>
  );
}
