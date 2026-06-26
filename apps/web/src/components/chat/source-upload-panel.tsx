import { useState, useEffect, useCallback, useRef } from "react";
import { Paperclip, Link2, Trash2, FileText, Loader2, X } from "lucide-react";
import { listSources, uploadSource, addSourceUrl, deleteSource } from "@/lib/api-client";
import type { SourceRecord } from "@ai-teacher/shared";

// 迭代 009：学习资料上传面板（文件 + URL + 列表/状态 + 删除）。
// 单用户本地应用，userId 复用 seed 用户常量（与 session-context / llm-config-form 一致）。
const USER_ID = "seed-user-ai-teacher";

const STATUS_LABEL: Record<string, string> = {
  pending: "排队中",
  processing: "解析中",
  ready: "就绪",
  failed: "失败",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-500",
  processing: "text-blue-500",
  ready: "text-emerald-500",
  failed: "text-destructive",
};

export function SourceUploadPanel() {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await listSources(USER_ID);
      setSources(data.sources);
    } catch {
      /* 忽略轮询错误 */
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // 有 pending/processing 时轮询，直到全部就绪/失败
  const hasPending = sources.some((s) => s.status === "pending" || s.status === "processing");
  useEffect(() => {
    if (!open || !hasPending) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [open, hasPending, load]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadSource(USER_ID, file);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addSourceUrl(USER_ID, url.trim());
      setUrl("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSource(id, USER_ID);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[var(--color-chat-input-placeholder)] transition-colors hover:bg-white/10 hover:text-[var(--color-chat-input-text)]"
        title="学习资料"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full right-0 z-50 mb-1 rounded-lg border border-border bg-popover p-3 shadow-lg"
            style={{ minWidth: "300px", maxWidth: "360px" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">学习资料</span>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* URL 导入 */}
            <div className="mb-2 flex gap-1">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUrl();
                  }
                }}
                placeholder="粘贴链接导入…"
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUrl}
                disabled={busy || !url.trim()}
                className="flex items-center justify-center rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 文件上传 */}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              上传 PDF / Markdown
            </button>
            <input ref={fileInput} type="file" accept=".pdf,.md,.markdown" onChange={handleFile} className="hidden" />

            {error && (
              <div className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{error}</div>
            )}

            {/* 资料列表 */}
            <div className="max-h-48 overflow-y-auto">
              {sources.length === 0 ? (
                <div className="py-3 text-center text-[11px] text-muted-foreground">
                  暂无资料，上传后 Agent 可基于资料教学
                </div>
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-secondary/50">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs text-foreground" title={s.title}>
                      {s.title}
                    </span>
                    <span className={`shrink-0 text-[10px] ${STATUS_COLOR[s.status] ?? "text-muted-foreground"}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
