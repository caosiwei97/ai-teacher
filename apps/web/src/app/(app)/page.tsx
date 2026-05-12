"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchSessions } from "@/lib/api-client";

const USER_ID = "seed-user-ai-teacher";

function generateNewSessionId() {
  const hex = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(parseInt(hex[16], 16) & 0x3 | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    fetchSessions(USER_ID)
      .then(({ sessions }) => {
        const learning = sessions.find(
          (s) => s.status === "active" || s.status === "diagnosing",
        );
        if (learning) {
          router.replace(`/learn/${learning.id}`);
        } else {
          router.replace(`/learn/${generateNewSessionId()}`);
        }
      })
      .catch(() => {
        router.replace(`/learn/${generateNewSessionId()}`);
      });
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-pulse-soft rounded-full bg-roadmap-fill" />
      </div>
    </div>
  );
}
