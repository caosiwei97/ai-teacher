"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg bg-slate-900">
      {language && (
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-1.5">
          <span className="text-xs text-slate-400">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      )}
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 opacity-0 hover:text-white group-hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-slate-100">
        <code className="font-mono">{children}</code>
      </pre>
    </div>
  );
}
