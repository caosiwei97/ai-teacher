"use client";

import { SessionContextProvider, useSession } from "@/contexts/session-context";
import { ThreeColumnLayout } from "@/components/layout/three-column";
import type { ReactNode } from "react";

function AppShell({ children }: { children: ReactNode }) {
  const { sessions, currentSessionId, selectSession, createNewSession, archiveSession } = useSession();

  return (
    <ThreeColumnLayout
      sessions={sessions}
      currentSessionId={currentSessionId ?? undefined}
      onSelectSession={selectSession}
      onNewSession={createNewSession}
      onArchiveSession={archiveSession}
    >
      {children}
    </ThreeColumnLayout>
  );
}

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <SessionContextProvider>
      <AppShell>{children}</AppShell>
    </SessionContextProvider>
  );
}
