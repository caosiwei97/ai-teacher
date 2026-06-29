import { Component, useState, type ReactNode } from "react";
import type { InteractiveBlock as InteractiveBlockType } from "@ai-teacher/shared";
import { sanitizeInteractiveHtml } from "@ai-teacher/shared/services/sanitize-html";
import { CodeBlock } from "@/components/chat/code-block";

// 迭代 050②：互动教学产物渲染器。
// iframe sandbox="allow-scripts" 隔离 DOM/cookie（不允许 same-origin），
// 配合 sanitizeInteractiveHtml 基本净化（移除外部脚本/javascript:/on*）。
// 降级：超大 HTML → 代码原文；React 渲染异常 → ErrorBoundary 兜底文字。

interface InteractiveBlockProps {
  block: InteractiveBlockType;
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  onError?: () => void;
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}

class InteractiveErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function DegradedView({ html, reason }: { html: string; reason: string }) {
  return (
    <div className="rounded-lg border border-accent/30 p-3">
      <p className="mb-2 text-xs text-muted-foreground">⚠️ {reason}</p>
      <CodeBlock language="html">{html}</CodeBlock>
    </div>
  );
}

export function InteractiveBlockRenderer({ block }: InteractiveBlockProps) {
  const [failed, setFailed] = useState(false);
  const result = sanitizeInteractiveHtml(block.html);

  if (result.degraded) {
    return <DegradedView html={block.html} reason="互动产物过大，已转为代码原文" />;
  }
  if (failed) {
    return <DegradedView html={block.html} reason="互动内容无法显示，已转为代码原文" />;
  }

  return (
    <InteractiveErrorBoundary
      fallback={<DegradedView html={block.html} reason="互动内容渲染异常，已转为代码原文" />}
      onError={() => setFailed(true)}
    >
      <iframe
        srcDoc={result.html}
        sandbox="allow-scripts"
        title="互动教学产物"
        className="w-full rounded-lg border border-code-border bg-white"
        style={{ minHeight: "240px" }}
      />
    </InteractiveErrorBoundary>
  );
}
