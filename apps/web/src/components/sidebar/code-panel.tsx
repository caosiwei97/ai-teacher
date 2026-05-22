
import { useState, useCallback, useRef, useEffect } from "react";
import { CodeEditor } from "@/components/editor/code-editor";
import { SandboxFileTree } from "@/components/editor/sandbox-file-tree";
import { SandboxTerminal } from "@/components/editor/sandbox-terminal";
import { useSandbox } from "@/contexts/sandbox-context";
import {
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FolderTree,
  Save,
  Play,
  Download,
} from "lucide-react";

interface CodePanelProps {
  code: string;
  language: string;
  instruction?: string;
  onCodeChange: (code: string) => void;
}

const LANGUAGE_TO_FILENAME: Record<string, string> = {
  python: "main.py",
  javascript: "index.js",
  typescript: "index.ts",
  java: "Main.java",
  cpp: "main.cpp",
};

const PY_BIN = "/opt/python/versions/cpython-3.12*/bin";

const LANGUAGE_RUN_CMD: Record<string, string> = {
  python: `${PY_BIN}/python3 /workspace/main.py`,
  javascript: "node /workspace/index.js",
  typescript: "npx ts-node /workspace/index.ts",
  java: "cd /workspace && javac Main.java && java Main",
  cpp: "cd /workspace && g++ -o main main.cpp && ./main",
};

const LANGUAGE_INSTALL_CMD: Record<string, (deps: string[]) => string> = {
  python: (deps) => `uv pip install --break-system-packages --python ${PY_BIN}/python3 ${deps.join(" ")}`,
  javascript: (deps) => `cd /workspace && npm install ${deps.join(" ")}`,
  typescript: (deps) => `cd /workspace && npm install ${deps.join(" ")}`,
};

const PYTHON_STDLIB = new Set([
  "abc", "argparse", "ast", "asyncio", "base64", "bisect", "collections",
  "concurrent", "contextlib", "copy", "csv", "dataclasses", "datetime",
  "decimal", "difflib", "enum", "errno", "fnmatch", "fractions", "functools",
  "gc", "glob", "gzip", "hashlib", "heapq", "hmac", "html", "http",
  "importlib", "inspect", "io", "itertools", "json", "logging", "math",
  "multiprocessing", "operator", "os", "pathlib", "pickle", "platform",
  "pprint", "queue", "random", "re", "secrets", "shutil", "signal",
  "socket", "sqlite3", "ssl", "statistics", "string", "struct", "subprocess",
  "sys", "tempfile", "textwrap", "threading", "time", "timeit", "traceback",
  "typing", "typing_extensions", "unittest", "urllib", "uuid", "warnings",
  "weakref", "xml", "zipfile", "zlib",
]);

function extractDeps(code: string, lang: string): string[] {
  if (lang === "python") {
    const deps = new Set<string>();
    for (const match of code.matchAll(/^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm)) {
      const mod = match[1];
      if (!PYTHON_STDLIB.has(mod)) deps.add(mod);
    }
    return [...deps];
  }
  if (lang === "javascript" || lang === "typescript") {
    const deps = new Set<string>();
    for (const match of code.matchAll(/(?:require\s*\(\s*['"]|from\s+['"])([^./][^'"]*)['"]/g)) {
      const pkg = match[1].startsWith("@") ? match[1] : match[1].split("/")[0];
      deps.add(pkg);
    }
    return [...deps];
  }
  return [];
}

const EDITOR_MIN = 100;
const TERMINAL_MIN = 80;

const IDE = {
  bg: "#1e1e2e",
  surface: "#181825",
  border: "#313244",
  text: "#cdd6f4",
  textMuted: "#6c7086",
  accent: "#89b4fa",
  hover: "#313244",
};

export function CodePanel({ code, language, instruction, onCodeChange }: CodePanelProps) {
  const sandbox = useSandbox();
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  const [editorRatio, setEditorRatio] = useState(0.6);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const pushCodeRef = useRef<string>("");

  const currentCode = sandbox.openFilePath ? sandbox.openFileContent : code;
  const displayLanguage = sandbox.openFilePath
    ? extToLanguage(sandbox.openFilePath)
    : language;
  const dirty = sandbox.openFilePath ? sandbox.dirty : false;

  useEffect(() => {
    if (!code || code === pushCodeRef.current) return;
    pushCodeRef.current = code;

    const filename = LANGUAGE_TO_FILENAME[language] ?? "main.py";
    const path = `/workspace/${filename}`;

    sandbox.writeAndOpen(path, code).catch(() => {});
  }, [code, language, sandbox]);

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
      sandbox.setOpenFileContent(value);
    } else {
      onCodeChange(value);
    }
  }

  function handleSave() {
    if (sandbox.openFilePath && dirty) {
      sandbox.saveFile(sandbox.openFilePath, sandbox.openFileContent);
    }
  }

  async function handleRun() {
    if (dirty && sandbox.openFilePath) {
      await sandbox.saveFile(sandbox.openFilePath, sandbox.openFileContent);
    }
    const cmd = LANGUAGE_RUN_CMD[displayLanguage];
    if (cmd) {
      sandbox.sendPtyCommand(cmd);
    }
  }

  function handleInstall() {
    const deps = extractDeps(currentCode, displayLanguage);
    if (deps.length === 0) return;
    const cmdFn = LANGUAGE_INSTALL_CMD[displayLanguage];
    if (cmdFn) {
      sandbox.sendPtyCommand(cmdFn(deps));
    }
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
    : "60%";

  const fileName = sandbox.openFilePath
    ? sandbox.openFilePath.split("/").pop()
    : (LANGUAGE_TO_FILENAME[language] ?? "main.py");

  return (
    <div
      className={
        fullscreen
          ? "ide-dark fixed inset-0 z-50 flex flex-col"
          : "ide-dark flex h-full flex-col"
      }
      style={{ background: IDE.bg }}
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center justify-between px-2 py-1"
        style={{
          background: IDE.bg,
          borderBottom: `1px solid ${IDE.border}`,
        }}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFileTree((v) => !v)}
            className="rounded p-1.5 transition-colors"
            style={{
              color: showFileTree ? IDE.text : IDE.textMuted,
              background: showFileTree ? IDE.hover : "transparent",
            }}
            title="文件树"
          >
            <FolderTree className="h-4 w-4" />
          </button>
          <span
            className="text-xs font-medium"
            style={{ color: IDE.text }}
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
            className="rounded p-1.5 transition-colors hover:bg-[#313244]"
            style={{ color: IDE.textMuted }}
            title="复制代码"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded p-1.5 transition-colors hover:bg-[#313244]"
              style={{ color: IDE.textMuted }}
              title="保存"
            >
              <Save className="h-4 w-4" />
            </button>
          )}
          <div
            className="mx-1 h-4 w-px"
            style={{ background: IDE.border }}
          />
          <button
            type="button"
            onClick={handleInstall}
            className="rounded p-1.5 transition-colors"
            style={{ color: IDE.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(137,180,250,0.1)"; e.currentTarget.style.color = "#89b4fa"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = IDE.textMuted; }}
            title="安装依赖"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="rounded p-1.5 transition-colors"
            style={{ color: "#a6e3a1" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(166,227,161,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="运行"
          >
            <Play className="h-4 w-4" />
          </button>
          <div
            className="mx-1 h-4 w-px"
            style={{ background: IDE.border }}
          />
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="rounded p-1.5 transition-colors hover:bg-[#313244]"
            style={{ color: IDE.textMuted }}
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

      {/* Instruction bar */}
      {instruction && (
        <div
          className="shrink-0 px-3 py-1.5"
          style={{
            background: IDE.bg,
            borderBottom: `1px solid ${IDE.border}`,
          }}
        >
          <p
            className="text-xs leading-relaxed"
            style={{ color: "#f9e2af" }}
          >
            💡 {instruction}
          </p>
        </div>
      )}

      {/* Main area: File tree | (Editor + Terminal) */}
      <div ref={splitContainerRef} className="flex min-h-0 flex-1 overflow-hidden">
        {/* File tree */}
        {showFileTree && (
          <div
            className="h-full w-[220px] shrink-0 overflow-y-auto"
            style={{
              background: IDE.surface,
              borderRight: `1px solid ${IDE.border}`,
            }}
          >
            <div
              className="px-3 py-2"
              style={{ borderBottom: `1px solid ${IDE.border}` }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: IDE.textMuted }}
              >
                资源管理器
              </span>
            </div>
            <SandboxFileTree />
          </div>
        )}

        {/* Editor + Terminal split */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Editor */}
          <div style={{ height: editorHeight }} className="shrink-0 overflow-hidden">
            <CodeEditor
              language={displayLanguage}
              value={currentCode}
              onChange={handleCodeChange}
            />
          </div>

          <DarkDivider onResize={handleResize} />

          {/* Terminal */}
          <div className="min-h-[80px] flex-1">
            <SandboxTerminal />
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkDivider({ onResize }: { onResize: (delta: number) => void }) {
  const lastPos = useRef(0);

  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        lastPos.current = e.clientY;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "row-resize";
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1)) return;
        const delta = e.clientY - lastPos.current;
        if (delta !== 0) {
          lastPos.current = e.clientY;
          onResize(delta);
        }
      }}
      onPointerUp={() => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }}
      onPointerCancel={() => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }}
      className="relative shrink-0 cursor-row-resize select-none touch-none"
      style={{ height: 3, background: IDE.border }}
    >
      <div className="absolute inset-x-0 -top-1 -bottom-1" />
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
