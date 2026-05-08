"use client";

import { useState } from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { PanelLeftOpen, PanelRightClose } from "lucide-react";

interface Session {
  id: string;
  topic: string;
  status: string;
  progress: { totalNodes: number; masteredNodes: number };
}

interface Node {
  id: string;
  index: number;
  title: string;
  description: string;
  status: string;
  masteryScore: number;
}

interface ThreeColumnLayoutProps {
  sessions: Session[];
  currentSessionId: string;
  nodes: Node[];
  onSelectSession: (id: string) => void;
  children: React.ReactNode;
}

export function ThreeColumnLayout({
  sessions,
  currentSessionId,
  nodes,
  onSelectSession,
  children,
}: ThreeColumnLayoutProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <LeftSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={onSelectSession}
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed(!leftCollapsed)}
      />

      <div className="relative flex flex-1 flex-col">
        <div className="absolute left-3 top-3 z-10 lg:hidden">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary"
          >
            <PanelLeftOpen className="h-4 w-4 text-foreground" />
          </button>
        </div>
        {rightCollapsed && (
          <div className="absolute right-3 top-3 z-10 lg:hidden">
            <button
              onClick={() => setRightCollapsed(!rightCollapsed)}
              className="rounded-lg border border-border bg-card p-2 shadow-sm transition-colors hover:bg-secondary"
            >
              <PanelRightClose className="h-4 w-4 text-foreground" />
            </button>
          </div>
        )}
        {children}
      </div>

      {!rightCollapsed && (
        <div className="hidden lg:block">
          <RightSidebar nodes={nodes} />
        </div>
      )}
    </div>
  );
}
