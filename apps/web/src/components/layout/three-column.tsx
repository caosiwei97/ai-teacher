
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function handleMobileSelect(id: string) {
    onSelectSession(id);
    setMobileSidebarOpen(false);
  }

  function handleMobileNewSession() {
    onNewSession?.();
    setMobileSidebarOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden h-full lg:block">
        <LeftSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelect={onSelectSession}
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((collapsed) => !collapsed)}
          onNewSession={onNewSession}
          onArchiveSession={onArchiveSession}
        />
      </div>

      {mobileSidebarOpen && (
        <>
          <button
            type="button"
            aria-label="关闭侧栏"
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside
            id="mobile-session-sidebar"
            data-testid="mobile-session-sidebar"
            aria-label="会话侧栏"
            className="fixed inset-y-0 left-0 z-40 shadow-xl lg:hidden"
          >
            <LeftSidebar
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelect={handleMobileSelect}
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              onNewSession={handleMobileNewSession}
              onArchiveSession={onArchiveSession}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="absolute left-3 top-3 z-10 lg:hidden">
          <button
            type="button"
            aria-label="打开侧栏"
            aria-controls="mobile-session-sidebar"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <PanelLeftOpen className="h-5 w-5 text-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
