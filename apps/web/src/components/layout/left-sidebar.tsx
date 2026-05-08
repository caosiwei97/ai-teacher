"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, BookOpen, GraduationCap } from "lucide-react";

interface Session {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number };
}

interface LeftSidebarProps {
  sessions: Session[];
  currentSessionId: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function LeftSidebar({ sessions, currentSessionId, onSelect, collapsed, onToggle }: LeftSidebarProps) {
  const active = sessions.filter((s) => s.status === "active");
  const completed = sessions.filter((s) => s.status === "completed");

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex h-full w-12 items-center justify-center border-r border-sidebar-surface bg-sidebar-bg text-sidebar-text transition-colors hover:bg-sidebar-hover"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex h-full w-[272px] flex-col bg-sidebar-bg text-sidebar-text">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-active">
            <GraduationCap className="h-4 w-4 text-sidebar-active-text" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">AI Teacher</h1>
        </div>
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-sidebar-muted transition-colors hover:bg-sidebar-surface hover:text-sidebar-text"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
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
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                    isActive
                      ? "bg-sidebar-active text-sidebar-active-text shadow-sm"
                      : "text-sidebar-text hover:bg-sidebar-hover",
                  )}
                >
                  <p className="truncate text-[13px] font-medium leading-snug">{s.topic}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-sidebar-surface">
                      <div
                        className={cn(
                          "h-1 rounded-full transition-all",
                          isActive ? "bg-white/60" : "bg-sidebar-muted/50",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className={cn("text-[10px]", isActive ? "text-white/70" : "text-sidebar-muted")}>
                      {s.progress.masteredNodes}/{s.progress.totalNodes}
                    </span>
                  </div>
                </button>
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
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "mb-1 w-full rounded-lg px-3 py-2 text-left transition-all duration-150",
                  s.id === currentSessionId
                    ? "bg-sidebar-active text-sidebar-active-text"
                    : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
                )}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <p className="truncate text-[13px]">{s.topic}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
