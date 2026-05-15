
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
  Terminal,
  Files,
  X,
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

const LANGUAGE_TO_FILENAME: Record<string, string> = {
  python: "main.py",
  javascript: "index.js",
  typescript: "index.ts",
  java: "Main.java",
  cpp: "main.cpp",
};

const EDITOR_MIN = 100;
const TERMINAL_MIN = 80;

const IDE_COLORS = {
  activityBar: "#181825",
  tabBar: "#1e1e2e",
  sidebar: "#181825",
  border: "#313244",
  text: "#cdd6f4",
  textMuted: "#6c7086",
  accent: "#89b4fa",
  activeTab: "#1e1e2e",
  inactiveTab: "#181825",
  hover: "#313244",
};

interface OpenTab {
  path: string;
  name: string;
}

export function CodePanel({ code, language, instruction, onCodeChange, llmConfigId }: CodePanelProps) {
  const sandbox = useSandbox();
  const { execute, isExecuting } = useCodeExec();
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  const [editorRatio, setEditorRatio] = useState(0.55);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Track pushCode origin to avoid re-triggering
  const pushCodeRef = useRef<string>(code);
  const pushCodeLangRef = useRef<string>(language);

  const currentCode = activeTabPath ? sandbox.openFileContent : code;
  const displayLanguage = activeTabPath
    ? extToLanguage(sandbox.openFilePath ?? "")
    : language;
  const dirty = activeTabPath ? sandbox.dirty : false;

  // Sync activeTabPath with sandbox.openFilePath when user opens from file tree
  useEffect(() => {
    if (sandbox.openFilePath && sandbox.openFilePath !== activeTabPath) {
      const name = sandbox.openFilePath.split("/").pop() ?? sandbox.openFilePath;
      setOpenTabs((prev) => {
        if (prev.some((t) => t.path === sandbox.openFilePath)) return prev;
        return [...prev, { path: sandbox.openFilePath!, name }];
      });
      setActiveTabPath(sandbox.openFilePath);
    }
    if (!sandbox.openFilePath && activeTabPath) {
      setActiveTabPath(null);
    }
  }, [sandbox.openFilePath, activeTabPath]);

  // Auto-create sandbox file on pushCode (code prop change from parent)
  useEffect(() => {
    if (!code || code === pushCodeRef.current) return;
    pushCodeRef.current = code;
    pushCodeLangRef.current = language;

    const filename = LANGUAGE_TO_FILENAME[language] ?? "main.py";
    const path = `/workspace/${filename}`;

    (async () => {
      try {
        await sandbox.saveFile(path, code);
        await sandbox.refreshFileTree();
        await sandbox.openFile(path);

        setOpenTabs((prev) => {
          if (prev.some((t) => t.path === path)) return prev;
          return [...prev, { path, name: filename }];
        });
        setActiveTabPath(path);
      } catch {
        // Sandbox not available yet, silently skip
      }
    })();
  }, [code, language, sandbox]);

  // Fullscreen escape
  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  function handleCodeChange(value: string) {
    if (activeTabPath) {
      sandbox.saveFile(activeTabPath, value);
    } else {
      onCodeChange(value);
    }
  }

  async function handleRun() {
    const codeToRun = activeTabPath ? sandbox.openFileContent : code;
    const langId = JUDGE0_IDS[displayLanguage] ?? 63;
    await execute(codeToRun, langId, undefined, llmConfigId);
  }

  const handleCopy = useCallback(() => {
    const text = activeTabPath ? sandbox.openFileContent : code;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [activeTabPath, sandbox.openFileContent, code]);

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

  const fileName = activeTabPath
    ? activeTabPath.split("/").pop()
    : (LANGUAGE_LABELS[language] ?? language);

  // Tab close handler
  function handleCloseTab(path: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (activeTabPath === path) {
        if (next.length > 0) {
          const last = next[next.length - 1];
          sandbox.openFile(last.path);
          setActiveTabPath(last.path);
        } else {
          setActiveTabPath(null);
        }
      }
      return next;
    });
  }

  // Tab click handler
  function handleTabClick(path: string) {
    sandbox.openFile(path);
    setActiveTabPath(path);
  }

  // Compute display tabs: always include the pushCode file if no sandbox files open
  const displayTabs = activeTabPath ? openTabs : [];

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col"
          : "flex h-full flex-col"
      }
      style={{ background: fullscreen ? IDE_COLORS.tabBar : undefined }}
    >
      {/* Main IDE layout: Activity Bar | Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar row (run, copy, save, fullscreen) */}
        <div
          className="flex shrink-0 items-center justify-between px-2 py-1"
          style={{
            background: IDE_COLORS.tabBar,
            borderBottom: `1px solid ${IDE_COLORS.border}`,
          }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowFileTree((v) => !v)}
              className="rounded p-1.5 transition-colors"
              style={{
                color: showFileTree ? IDE_COLORS.text : IDE_COLORS.textMuted,
                background: showFileTree ? IDE_COLORS.hover : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!showFileTree) e.currentTarget.style.background = IDE_COLORS.hover;
              }}
              onMouseLeave={(e) => {
                if (!showFileTree) e.currentTarget.style.background = "transparent";
              }}
              title="文件树"
            >
              <FolderTree className="h-4 w-4" />
            </button>
            <span
              className="text-xs font-medium"
              style={{ color: IDE_COLORS.text }}
            >
              {fileName}
            </span>
            {dirty && (
              <span
                className="inline-block h-2 w-2 rounded-full bg-amber-400"
                title="未保存"
              />
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-1.5 transition-colors"
              style={{ color: IDE_COLORS.textMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = IDE_COLORS.hover;
                e.currentTarget.style.color = IDE_COLORS.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = IDE_COLORS.textMuted;
              }}
              title="复制代码"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            {activeTabPath && dirty && (
              <button
                type="button"
                onClick={() => sandbox.saveFile(activeTabPath!, sandbox.openFileContent)}
                className="rounded p-1.5 transition-colors"
                style={{ color: IDE_COLORS.textMuted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = IDE_COLORS.hover;
                  e.currentTarget.style.color = IDE_COLORS.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = IDE_COLORS.textMuted;
                }}
                title="保存"
              >
                <Save className="h-4 w-4" />
              </button>
            )}
            <div
              className="mx-1 h-4 w-px"
              style={{ background: IDE_COLORS.border }}
            />
            <button
              type="button"
              onClick={handleRun}
              disabled={isExecuting || !currentCode.trim()}
              className="rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: IDE_COLORS.textMuted }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = "rgba(166, 227, 161, 0.1)";
                  e.currentTarget.style.color = "#a6e3a1";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = IDE_COLORS.textMuted;
              }}
              title="运行"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <div
              className="mx-1 h-4 w-px"
              style={{ background: IDE_COLORS.border }}
            />
            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              className="rounded p-1.5 transition-colors"
              style={{ color: IDE_COLORS.textMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = IDE_COLORS.hover;
                e.currentTarget.style.color = IDE_COLORS.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = IDE_COLORS.textMuted;
              }}
              title={fullscreen ? "退出全屏" : "全屏"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="flex shrink-0 items-center overflow-x-auto"
          style={{
            background: IDE_COLORS.inactiveTab,
            borderBottom: `1px solid ${IDE_COLORS.border}`,
          }}
        >
          {displayTabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            return (
              <div
                key={tab.path}
                className="group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: isActive ? IDE_COLORS.activeTab : IDE_COLORS.inactiveTab,
                  color: isActive ? IDE_COLORS.text : IDE_COLORS.textMuted,
                  borderRight: `1px solid ${IDE_COLORS.border}`,
                  borderBottom: isActive
                    ? `2px solid ${IDE_COLORS.accent}`
                    : `2px solid transparent`,
                }}
                onClick={() => handleTabClick(tab.path)}
              >
                <span>{tab.name}</span>
                <button
                  type="button"
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-[#45475a] group-hover:opacity-100"
                  style={{ color: IDE_COLORS.textMuted }}
                  onClick={(e) => handleCloseTab(tab.path, e)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Instruction bar */}
        {instruction && (
          <div
            className="shrink-0 px-4 py-2"
            style={{
              background: IDE_COLORS.tabBar,
              borderBottom: `1px solid ${IDE_COLORS.border}`,
            }}
          >
            <p
              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{
                background: "rgba(249, 226, 175, 0.05)",
                color: "#f9e2af",
              }}
            >
              💡 {instruction}
            </p>
          </div>
        )}

        {/* Editor + File tree + Activity bar row */}
        <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
          <div style={{ height: editorHeight }} className="flex shrink-0 overflow-hidden">
            {/* Activity bar */}
            <div
              className="flex w-10 shrink-0 flex-col items-center gap-1 py-2"
              style={{
                background: IDE_COLORS.activityBar,
                borderRight: `1px solid ${IDE_COLORS.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => setShowFileTree((v) => !v)}
                className="rounded p-1.5 transition-colors"
                style={{
                  color: showFileTree ? IDE_COLORS.accent : IDE_COLORS.textMuted,
                  background: showFileTree ? IDE_COLORS.hover : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!showFileTree) e.currentTarget.style.background = IDE_COLORS.hover;
                }}
                onMouseLeave={(e) => {
                  if (!showFileTree) e.currentTarget.style.background = "transparent";
                }}
                title="文件浏览器"
              >
                <Files className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="rounded p-1.5 transition-colors"
                style={{ color: IDE_COLORS.textMuted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = IDE_COLORS.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                title="终端"
              >
                <Terminal className="h-5 w-5" />
              </button>
            </div>

            {/* File tree */}
            {showFileTree && (
              <div
                className="h-full w-[180px] shrink-0 overflow-y-auto"
                style={{
                  background: IDE_COLORS.sidebar,
                  borderRight: `1px solid ${IDE_COLORS.border}`,
                }}
              >
                <SandboxFileTree />
              </div>
            )}

            {/* Editor */}
            <div className="min-w-0 flex-1">
              <CodeEditor
                key={activeTabPath ?? code}
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
