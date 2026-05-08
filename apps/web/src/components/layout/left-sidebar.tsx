"use client";

import { cn } from "@/lib/utils";

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
      <button onClick={onToggle} className="flex h-full w-10 items-center justify-center bg-slate-900 text-white hover:bg-slate-800">
        <span className="text-lg">→</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[280px] flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h1 className="text-lg font-bold">AI Teacher</h1>
        <button onClick={onToggle} className="rounded p-1 text-slate-400 hover:text-white">
          ←
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {active.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              学习中
            </h3>
            {active.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  s.id === currentSessionId
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                )}
              >
                <p className="truncate font-medium">{s.topic}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {s.progress.masteredNodes}/{s.progress.totalNodes} 已掌握
                </p>
              </button>
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h3 className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              已完成
            </h3>
            {completed.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  s.id === currentSessionId
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                )}
              >
                <p className="truncate font-medium">{s.topic}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
