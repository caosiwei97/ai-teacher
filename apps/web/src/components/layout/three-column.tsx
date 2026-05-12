"use client";

import { useState } from "react";
import { LeftSidebar } from "./left-sidebar";
import { PanelLeftOpen } from "lucide-react";

interface Session {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number };
}

interface ThreeColumnLayoutProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelectSession: (id: string) => void;
  onNewSession?: () => void;
  onArchiveSession?: (id: string) => void;
  children: React.ReactNode;
}

export function ThreeColumnLayout({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onArchiveSession,
  children,
}: ThreeColumnLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <LeftSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={onSelectSession}
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed(!leftCollapsed)}
        onNewSession={onNewSession}
        onArchiveSession={onArchiveSession}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="absolute left-3 top-3 z-10 lg:hidden">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary"
          >
            <PanelLeftOpen className="h-4 w-4 text-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
