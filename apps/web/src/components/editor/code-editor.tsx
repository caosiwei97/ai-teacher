
import { useCallback, useRef } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  compact?: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  cpp: "cpp",
  go: "go",
  jsx: "javascript",
  tsx: "typescript",
};

function getMonacoLanguage(lang: string): string {
  return LANGUAGE_MAP[lang] ?? lang;
}

function getTabSize(lang: string): number {
  return lang === "python" ? 4 : 2;
}

const THEME_NAME = "warm-dark";

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(THEME_NAME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6c7086", fontStyle: "italic" },
      { token: "keyword", foreground: "cba6f7" },
      { token: "string", foreground: "a6e3a1" },
      { token: "number", foreground: "fab387" },
      { token: "type", foreground: "89b4fa" },
      { token: "function", foreground: "89dceb" },
      { token: "variable", foreground: "cdd6f4" },
      { token: "operator", foreground: "89b4fa" },
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#cdd6f4",
      "editor.lineHighlightBackground": "#313244",
      "editor.selectionBackground": "#585b7066",
      "editorLineNumber.foreground": "#6c7086",
      "editorLineNumber.activeForeground": "#cdd6f4",
      "editor.inactiveSelectionBackground": "#45475a40",
      "editorCursor.foreground": "#f5e0dc",
      "editorIndentGuide.background": "#45475a",
      "editorIndentGuide.activeBackground": "#585b70",
      "editorBracketMatch.background": "#45475a80",
      "editorBracketMatch.border": "#89b4fa80",
    },
  });
};

export function CodeEditor({
  language,
  value,
  onChange,
  readOnly = false,
  compact = false,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChangeRef.current?.(newValue ?? "");
    },
    [],
  );

  const monacoLang = getMonacoLanguage(language);

  const options: MonacoEditor.IStandaloneEditorConstructionOptions = {
    readOnly,
    automaticLayout: true,
    wordWrap: compact ? "off" : "on",
    lineNumbers: "on",
    folding: true,
    bracketPairColorization: { enabled: true },
    suggest: { showMethods: true, showFunctions: true, showConstants: true, showProperties: true },
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    renderWhitespace: "selection",
    tabSize: getTabSize(language),
    minimap: { enabled: false },
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
      vertical: "auto",
      horizontal: "auto",
    },
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    fontLigatures: true,
    contextmenu: false,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    ...(compact ? { maxLines: 12, minimap: { enabled: false } } : {}),
  };

  return (
    <div className={compact ? "max-h-[200px] overflow-hidden rounded-lg" : "h-full w-full"}>
      <Editor
        height={compact ? 200 : "100%"}
        width="100%"
        language={monacoLang}
        value={value}
        onChange={handleChange}
        theme={THEME_NAME}
        beforeMount={beforeMount}
        onMount={handleMount}
        options={options}
        loading={null}
      />
    </div>
  );
}
