import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Archive, Settings, MessageSquare } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "react-router";

interface Session {
  id: string;
  topic: string;
  status: string;
  activeMode?: "learning" | "review" | "interview";
  progress: { totalNodes: number; masteredNodes: number };
}

// 模式图标 + 主色（spec §5.3③ 会话前模式图标 + §5.5 进度条颜色随模式）
function modeIcon(activeMode?: string): string {
  if (activeMode === "review") return "🔁";
  if (activeMode === "interview") return "🔥";
  return "🌱";
}
function modeColorVar(activeMode?: string): string {
  if (activeMode === "review") return "var(--color-review)";
  if (activeMode === "interview") return "var(--color-interview)";
  return "var(--color-primary)";
}

interface LeftSidebarProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onNewSession?: () => void;
  onArchiveSession?: (id: string) => void;
}

export function LeftSidebar({
  sessions,
  currentSessionId,
  onSelect,
  collapsed,
  onToggle,
  onNewSession,
  onArchiveSession,
}: LeftSidebarProps) {
  const newSessions = sessions.filter((s) => s.status === "new");
  const active = sessions.filter((s) => s.status === "active" || s.status === "diagnosing");
  const completed = sessions.filter((s) => s.status === "completed");

  if (collapsed) {
    return (
      <div className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4 transition-all duration-300">
        <div className="flex h-8 w-8 items-center justify-center" title="AI Teacher">
          <Logo size={28} />
        </div>

        {onNewSession && (
          <button
            onClick={onNewSession}
            className="mt-4 flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
            title="新建会话"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={onToggle}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          title="展开会话列表"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        <div className="mb-2">
          <ThemeToggle />
        </div>

        <Link
          to="/settings"
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          title="模型设置"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          title="展开侧栏"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center">
            <Logo size={28} />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">AI Teacher</h1>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={onToggle}
            className="rounded-md p-1 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {onNewSession && (
        <div className="px-3 pb-3">
          <button
            onClick={onNewSession}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-accent/40 bg-sidebar-accent/10 px-3 py-2 text-sm font-medium text-sidebar-accent transition-colors hover:bg-sidebar-accent/20"
          >
            <Plus className="h-4 w-4" />
            新对话
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {newSessions.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-widest text-sidebar-muted">
              新对话
            </h3>
            {newSessions.map((s) => {
              const isActive = s.id === currentSessionId;
              const isLastSessionAndNew = sessions.length === 1 && s.status === "new";
              return (
                <div key={s.id} className="group relative mb-1">
                  <button
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                      isActive
                        ? "bg-sidebar-active text-sidebar-accent-foreground border-l-2 border-sidebar-accent"
                        : "text-sidebar-foreground hover:bg-sidebar-hover",
                    )}
                  >
                    <p className="truncate text-[13px] font-medium leading-snug pr-6">
                      <span className="mr-1.5">{modeIcon(s.activeMode)}</span>
                      {s.topic}
                    </p>
                  </button>
                  {onArchiveSession && !isLastSessionAndNew && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveSession(s.id); }}
                      className="absolute right-2 top-2.5 rounded p-1 text-sidebar-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {active.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-widest text-sidebar-muted">
              学习中
            </h3>
            {active.map((s) => {
              const isActive = s.id === currentSessionId;
              const progress = s.progress.totalNodes > 0
                ? Math.round((s.progress.masteredNodes / s.progress.totalNodes) * 100)
                : 0;
              return (
                <div key={s.id} className="group relative mb-1">
                  <button
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                      isActive
                        ? "bg-sidebar-active text-sidebar-accent-foreground border-l-2 border-sidebar-accent"
                        : "text-sidebar-foreground hover:bg-sidebar-hover",
                    )}
                  >
                    <p className="truncate text-[13px] font-medium leading-snug pr-6">
                      <span className="mr-1.5">{modeIcon(s.activeMode)}</span>
                      {s.topic}
                    </p>
                    {s.progress.totalNodes > 0 ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-sidebar-hover">
                          <div
                            className="h-1 rounded-full transition-all"
                            style={{ width: `${progress}%`, background: modeColorVar(s.activeMode) }}
                          />
                        </div>
                        <span className={cn("text-[10px]", isActive ? "text-sidebar-accent-foreground/70" : "text-sidebar-muted")}>
                          {s.progress.masteredNodes}/{s.progress.totalNodes}
                        </span>
                      </div>
                    ) : s.status === 'diagnosing' ? (
                      <span className={cn("mt-1 inline-block text-[10px]", isActive ? "text-sidebar-accent-foreground/70" : "text-sidebar-muted")}>
                        诊断中…
                      </span>
                    ) : null}
                  </button>
                  {onArchiveSession && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveSession(s.id); }}
                      className="absolute right-2 top-2.5 rounded p-1 text-sidebar-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h3 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-widest text-sidebar-muted">
              已完成
            </h3>
            {completed.map((s) => (
              <div key={s.id} className="group relative mb-1">
                <button
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left transition-all duration-150",
                    s.id === currentSessionId
                      ? "bg-sidebar-active text-sidebar-accent-foreground"
                      : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
                  )}
                >
                  <div className="flex items-center gap-2 pr-6">
                    <span className="shrink-0 text-xs">{modeIcon(s.activeMode)}</span>
                    <p className="truncate text-[13px]">{s.topic}</p>
                    <span className="ml-auto shrink-0 text-[10px] text-sidebar-muted">✓</span>
                  </div>
                </button>
                {onArchiveSession && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onArchiveSession(s.id); }}
                    className="absolute right-2 top-2 rounded p-1 text-sidebar-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          模型设置
        </Link>
      </div>
    </div>
  );
}
