"use client";

import { useState } from "react";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { Menu, Map } from "lucide-react";

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
    <div className="flex h-screen overflow-hidden">
      <LeftSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={onSelectSession}
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed(!leftCollapsed)}
      />

      <div className="relative flex flex-1 flex-col">
        <div className="absolute left-2 top-2 z-10 md:hidden">
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="rounded bg-white p-1.5 shadow-md"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="absolute right-2 top-2 z-10 md:hidden">
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="rounded bg-white p-1.5 shadow-md"
          >
            <Map className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>

      {!rightCollapsed && (
        <div className="hidden md:block">
          <RightSidebar nodes={nodes} />
        </div>
      )}
    </div>
  );
}
