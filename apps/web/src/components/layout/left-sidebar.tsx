"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, BookOpen, GraduationCap, Plus, Archive } from "lucide-react";

interface Session {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number };
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
      <button
        onClick={onToggle}
        className="flex h-full w-12 items-center justify-center border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-colors hover:bg-sidebar-hover"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-accent">
            <GraduationCap className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">AI Teacher</h1>
        </div>
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {onNewSession && (
        <div className="px-3 pb-2">
          <button
            onClick={onNewSession}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sidebar-muted px-3 py-2 text-[13px] text-sidebar-muted transition-colors hover:border-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            新建会话
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
              return (
                <div key={s.id} className="mb-1">
                  <button
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                      isActive
                        ? "bg-sidebar-active text-sidebar-accent-foreground border-l-2 border-sidebar-accent"
                        : "text-sidebar-foreground hover:bg-sidebar-hover",
                    )}
                  >
                    <p className="truncate text-[13px] font-medium leading-snug">{s.topic}</p>
                  </button>
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
                    <p className="truncate text-[13px] font-medium leading-snug pr-6">{s.topic}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-sidebar-hover">
                        <div
                          className={cn(
                            "h-1 rounded-full transition-all",
                            isActive ? "bg-sidebar-accent-foreground/60" : "bg-sidebar-muted/50",
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={cn("text-[10px]", isActive ? "text-sidebar-accent-foreground/70" : "text-sidebar-muted")}>
                        {s.progress.masteredNodes}/{s.progress.totalNodes}
                      </span>
                    </div>
                  </button>
                  {onArchiveSession && !isActive && (
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
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <p className="truncate text-[13px]">{s.topic}</p>
                  </div>
                </button>
                {onArchiveSession && s.id !== currentSessionId && (
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
    </div>
  );
}
