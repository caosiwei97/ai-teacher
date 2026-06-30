import { Component, useState, useEffect, useRef, type ReactNode } from "react";
import type { InteractiveBlock as InteractiveBlockType } from "@ai-teacher/shared";
import { sanitizeInteractiveHtml } from "@ai-teacher/shared/services/sanitize-html";
import { CodeBlock } from "@/components/chat/code-block";
import { ArrowRight, Check, Loader2 } from "lucide-react";

// 迭代 050②：互动教学产物渲染器。
// iframe sandbox="allow-scripts" 隔离 DOM/cookie（不允许 same-origin），
// 配合 sanitizeInteractiveHtml 基本净化（移除外部脚本/javascript:/on*）。
// 降级：超大 HTML → 代码原文；React 渲染异常 → ErrorBoundary 兜底文字。

interface InteractiveBlockProps {
  block: InteractiveBlockType;
  onSubmit?: (payload: InteractiveSubmitPayload) => void;
}

export interface InteractiveSubmitPayload {
  answer?: string;
  feedback?: string;
  source: "iframe" | "manual";
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
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs text-muted-foreground">{reason}</p>
      <CodeBlock language="html">{html}</CodeBlock>
    </div>
  );
}

function injectBeforeBodyEnd(html: string, injection: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${injection}</body>`);
  }
  return `${html}${injection}`;
}

function trimText(text: string, maxLength = 240): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

export function InteractiveBlockRenderer({ block, onSubmit }: InteractiveBlockProps) {
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeIdRef = useRef(
    `interactive-${Math.random().toString(36).slice(2)}`,
  );
  const result = sanitizeInteractiveHtml(block.html);

  // iframe sandbox="allow-scripts"（无 same-origin）→ 父页不能读 contentDocument。
  // 改为 iframe 内脚本 postMessage 内容高度，父页监听设 iframe 高度（自适应，避免内容挤一起）
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.interactiveBridgeId !== bridgeIdRef.current) return;
      if (e.data?.type === "interactive-height" && typeof e.data.height === "number") {
        setHeight(e.data.height);
        return;
      }
      if (e.data?.type === "interactive-submit") {
        if (submitted) return;
        setSubmitted(true);
        onSubmit?.({
          source: "iframe",
          answer: typeof e.data.answer === "string" ? trimText(e.data.answer) : undefined,
          feedback: typeof e.data.feedback === "string" ? trimText(e.data.feedback) : undefined,
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSubmit, submitted]);

  function handleManualSubmit() {
    if (submitted) return;
    setSubmitted(true);
    onSubmit?.({ source: "manual", answer: "已完成互动课自测" });
  }

  if (result.degraded) {
    return <DegradedView html={block.html} reason="互动产物过大，已转为代码原文" />;
  }
  if (failed) {
    return <DegradedView html={block.html} reason="互动内容无法显示，已转为代码原文" />;
  }

  // 注入 CSS：互动课通用美化（覆盖 agent HTML 紧凑布局——选项垂直全宽 + 宽松间距，spec §2.1 形态A）
  const injectedStyle = `<style>body{margin:0;padding:16px;font-family:-apple-system,"PingFang SC",system-ui,sans-serif!important;line-height:1.6!important;color:#1f2937;background:#fff}h1,h2,h3{margin-top:0}button,input[type=button],input[type=submit],[role=button]{min-height:40px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#111827;transition:background-color .15s,border-color .15s,transform .15s}button:hover,input[type=button]:hover,input[type=submit]:hover,[role=button]:hover{border-color:#6366f1;background:#eef2ff}button:active,input[type=button]:active,input[type=submit]:active,[role=button]:active{transform:translateY(1px)}div[style*="flex-wrap"]{display:block!important}div[style*="flex-wrap"]>*{display:block!important;width:100%!important;margin:6px 0!important;padding:12px 16px!important;text-align:left!important;box-sizing:border-box!important;font-size:14px!important;line-height:1.5!important;cursor:pointer!important}#quiz button,[id*="quiz"] button,[class*="quiz"] button,[data-quiz] button{display:block;width:100%;margin:6px 0;padding:12px 16px;text-align:left;box-sizing:border-box;font-size:14px;line-height:1.5;cursor:pointer}input[type=range]{width:100%!important}</style>`;
  const bridgeId = JSON.stringify(bridgeIdRef.current);
  const heightScript = `<script>(function(){var bridgeId=${bridgeId};function s(){parent.postMessage({type:'interactive-height',interactiveBridgeId:bridgeId,height:document.documentElement.scrollHeight},'*');}if(document.readyState==='complete')s();else window.addEventListener('load',s);new ResizeObserver(s).observe(document.body);})();</script>`;
  const submitBridgeScript = `<script>(function(){var bridgeId=${bridgeId};var sent=false;function t(el){return (el&&((el.innerText||el.value||el.textContent)||'')).replace(/\\s+/g,' ').trim();}function feedback(){var selectors=['#feedback','#result','#out','#output','[data-feedback]','[aria-live]','.feedback','.result','.output'];for(var i=0;i<selectors.length;i++){var el=document.querySelector(selectors[i]);var text=t(el);if(text)return text;}return '';}function send(el){if(sent)return;sent=true;setTimeout(function(){parent.postMessage({type:'interactive-submit',interactiveBridgeId:bridgeId,answer:t(el),feedback:feedback()},'*');},120);}document.addEventListener('click',function(e){try{var target=e.target&&e.target.closest?e.target.closest('button,input[type="button"],input[type="submit"],[role="button"],[data-interactive-submit]'):null;if(!target||target.hasAttribute('data-no-submit'))return;var label=t(target);var quiz=target.closest('#quiz,[data-quiz],[data-self-check],.quiz,.self-test,.selfcheck,[class*="quiz"],[id*="quiz"],[class*="test"],[id*="test"]');var idClass=((target.id||'')+' '+(target.className||'')).toLowerCase();var answerLike=/(^|\\b)(opt|option|answer|choice|submit|check|quiz|test)(\\b|[-_a-z0-9])/.test(idClass)||/^(a|b|c|d|选项|答案|提交|检查|确认|完成)/i.test(label);if(quiz||answerLike||target.hasAttribute('data-interactive-submit'))send(target);}catch(_err){}},true);})();</script>`;
  const srcDoc = injectBeforeBodyEnd(
    result.html,
    injectedStyle + heightScript + submitBridgeScript,
  );

  return (
    <InteractiveErrorBoundary
      fallback={<DegradedView html={block.html} reason="互动内容渲染异常，已转为代码原文" />}
      onError={() => setFailed(true)}
    >
      <div
        data-testid="interactive-lesson-card"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="border-b border-border bg-secondary/30 px-4 pb-2 pt-3">
          <p className="text-sm font-medium text-foreground">互动练习</p>
        </div>

        <div className="bg-background/40 p-3">
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            title="互动教学产物"
            className="w-full rounded-lg border border-border bg-white"
            style={{ height: height ? `${height}px` : undefined, minHeight: "240px" }}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border bg-secondary/20 px-4 py-3">
          {submitted ? (
            <>
              <span className="text-xs text-muted-foreground">自测已提交</span>
              <div
                data-testid="interactive-submit-status"
                className="flex items-center gap-1.5 text-xs font-medium text-roadmap-mastered"
              >
                <Check className="h-3.5 w-3.5" />
                <span>已提交</span>
              </div>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-roadmap-fill" />
                等待作答
              </span>
              <button
                type="button"
                onClick={handleManualSubmit}
                data-testid="interactive-complete-button"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                完成自测
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </InteractiveErrorBoundary>
  );
}
