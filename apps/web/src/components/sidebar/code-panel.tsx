"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { SandboxFileTree } from "@/components/editor/sandbox-file-tree";
import { SandboxTerminal } from "@/components/editor/sandbox-terminal";
import { ResizableDivider } from "@/components/layout/resizable-divider";
import { useSandbox } from "@/contexts/sandbox-context";
import { useCodeExec } from "@/hooks/use-code-exec";
import {
  Play,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FolderTree,
  Save,
} from "lucide-react";

interface CodePanelProps {
  code: string;
  language: string;
  instruction?: string;
  onCodeChange: (code: string) => void;
  llmConfigId?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
};

const JUDGE0_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
};

const EDITOR_MIN = 100;
const TERMINAL_MIN = 80;

export function CodePanel({ code, language, instruction, onCodeChange, llmConfigId }: CodePanelProps) {
  const sandbox = useSandbox();
  const { execute, isExecuting } = useCodeExec();
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  const [editorRatio, setEditorRatio] = useState(0.55);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const currentCode = sandbox.openFilePath ? sandbox.openFileContent : code;
  const displayLanguage = sandbox.openFilePath
    ? extToLanguage(sandbox.openFilePath)
    : language;
  const dirty = sandbox.dirty;

  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  function handleCodeChange(value: string) {
    if (sandbox.openFilePath) {
      sandbox.saveFile(sandbox.openFilePath, value);
    } else {
      onCodeChange(value);
    }
  }

  async function handleRun() {
    const codeToRun = sandbox.openFilePath ? sandbox.openFileContent : code;
    const langId = JUDGE0_IDS[displayLanguage] ?? 63;
    await execute(codeToRun, langId, undefined, llmConfigId);
  }

  const handleCopy = useCallback(() => {
    const text = sandbox.openFilePath ? sandbox.openFileContent : code;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [sandbox.openFilePath, sandbox.openFileContent, code]);

  const handleResize = useCallback((delta: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const totalHeight = container.clientHeight;
    if (totalHeight <= 0) return;

    setEditorRatio((prev) => {
      const currentPx = prev * totalHeight;
      const newPx = currentPx + delta;
      const clampedPx = Math.max(EDITOR_MIN, Math.min(totalHeight - TERMINAL_MIN, newPx));
      return clampedPx / totalHeight;
    });
  }, []);

  const editorHeight = splitContainerRef.current
    ? `${Math.round(editorRatio * splitContainerRef.current.clientHeight)}px`
    : "55%";

  const fileName = sandbox.openFilePath
    ? sandbox.openFilePath.split("/").pop()
    : (LANGUAGE_LABELS[language] ?? language);

  return (
    <div className={
      fullscreen
        ? "fixed inset-0 z-50 flex flex-col bg-background"
        : "flex h-full flex-col"
    }>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFileTree((v) => !v)}
            className={`rounded-md p-1.5 transition-colors ${
              showFileTree
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title="文件树"
          >
            <FolderTree className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-medium text-roadmap-fill">
            {fileName}
          </span>
          {dirty && (
            <span className="flex h-2 w-2 rounded-full bg-amber-400" title="未保存" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="复制代码"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {sandbox.openFilePath && dirty && (
            <button
              type="button"
              onClick={() => sandbox.saveFile(sandbox.openFilePath!, sandbox.openFileContent)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="保存"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={handleRun}
            disabled={isExecuting || !currentCode.trim()}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-green-500/10 hover:text-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="运行"
          >
            {isExecuting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={fullscreen ? "退出全屏" : "全屏"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {instruction && (
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs leading-relaxed text-amber-500 bg-amber-500/5 px-3 py-2 rounded-lg">
            💡 {instruction}
          </p>
        </div>
      )}

      <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
        <div style={{ height: editorHeight }} className="flex shrink-0 overflow-hidden">
          {showFileTree && (
            <>
              <div className="h-full w-[160px] shrink-0 overflow-y-auto border-r border-border bg-sidebar">
                <SandboxFileTree />
              </div>
            </>
          )}
          <div className="min-w-0 flex-1">
            <CodeEditor
              key={sandbox.openFilePath ?? code}
              language={displayLanguage}
              value={currentCode}
              onChange={handleCodeChange}
            />
          </div>
        </div>

        <ResizableDivider direction="vertical" onResize={handleResize} />

        <div className="min-h-[80px] flex-1">
          <SandboxTerminal />
        </div>
      </div>
    </div>
  );
}

function extToLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    rs: "rust",
    rb: "ruby",
    php: "php",
    sh: "bash",
    json: "json",
    md: "markdown",
    html: "html",
    css: "css",
  };
  return map[ext] ?? "plaintext";
}
