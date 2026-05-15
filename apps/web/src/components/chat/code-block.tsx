
import { useState, useMemo } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const highlightedCode = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(children, { language }).value;
      }
      return hljs.highlightAuto(children).value;
    } catch {
      return children;
    }
  }, [children, language]);

  async function handleCopy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative my-2.5 overflow-hidden rounded-lg border border-code-border bg-code-bg">
      {language && (
        <div className="flex items-center justify-between border-b border-code-border px-4 py-1.5">
          <span className="text-[11px] font-medium text-code-lang">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-code-lang transition-colors hover:bg-code-border hover:text-code-text"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      )}
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-code-lang opacity-0 transition-opacity hover:bg-code-border hover:text-code-text group-hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code
          className={`font-mono text-code-text ${language ? `language-${language}` : ""}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}
