import { Component, useState, useEffect, useRef, type ReactNode } from "react";
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
  const [height, setHeight] = useState<number | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const result = sanitizeInteractiveHtml(block.html);

  // iframe sandbox="allow-scripts"（无 same-origin）→ 父页不能读 contentDocument。
  // 改为 iframe 内脚本 postMessage 内容高度，父页监听设 iframe 高度（自适应，避免内容挤一起）
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (iframeRef.current?.contentWindow !== e.source) return;
      if (e.data?.type === "interactive-height" && typeof e.data.height === "number") {
        setHeight(e.data.height);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (result.degraded) {
    return <DegradedView html={block.html} reason="互动产物过大，已转为代码原文" />;
  }
  if (failed) {
    return <DegradedView html={block.html} reason="互动内容无法显示，已转为代码原文" />;
  }

  // 注入 CSS：互动课通用美化（覆盖 agent HTML 紧凑布局——选项垂直全宽 + 宽松间距，spec §2.1 形态A）
  const injectedStyle = `<style>div[style*="flex"]{display:block!important}button{display:block!important;width:100%!important;margin:6px 0!important;padding:12px 16px!important;text-align:left!important;box-sizing:border-box!important;font-size:14px!important;line-height:1.5!important;cursor:pointer!important}input[type=range]{width:100%!important}body{font-family:-apple-system,"PingFang SC",system-ui,sans-serif!important;line-height:1.6!important}</style>`;
  const heightScript = `<script>(function(){function s(){parent.postMessage({type:'interactive-height',height:document.documentElement.scrollHeight},'*');}if(document.readyState==='complete')s();else window.addEventListener('load',s);new ResizeObserver(s).observe(document.body);})();</script>`;

  return (
    <InteractiveErrorBoundary
      fallback={<DegradedView html={block.html} reason="互动内容渲染异常，已转为代码原文" />}
      onError={() => setFailed(true)}
    >
      <iframe
        ref={iframeRef}
        srcDoc={result.html + injectedStyle + heightScript}
        sandbox="allow-scripts"
        title="互动教学产物"
        className="w-full rounded-lg border border-code-border bg-white"
        style={{ height: height ? `${height}px` : undefined, minHeight: "240px" }}
      />
    </InteractiveErrorBoundary>
  );
}
