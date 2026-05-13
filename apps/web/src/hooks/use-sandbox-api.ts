"use client";

import { useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:38422";

export function useSandboxApi() {
  return useMemo(() => ({
    searchFiles: (path: string, pattern: string) =>
      fetch(`${API}/api/sandbox/files/search?path=${encodeURIComponent(path)}&pattern=${encodeURIComponent(pattern)}`)
        .then((r) => r.json()),

    getFileContent: (path: string) =>
      fetch(`${API}/api/sandbox/files/content?path=${encodeURIComponent(path)}`)
        .then((r) => r.json()),

    uploadFile: (path: string, content: string) => {
      const form = new FormData();
      form.append("file", new Blob([content], { type: "text/plain" }), path.split("/").pop() ?? "file");
      form.append("path", path);
      return fetch(`${API}/api/sandbox/files/upload`, { method: "POST", body: form }).then((r) => r.json());
    },

    createDirectory: (path: string) =>
      fetch(`${API}/api/sandbox/directories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      }).then((r) => r.json()),

    deleteFile: (path: string) =>
      fetch(`${API}/api/sandbox/files?path=${encodeURIComponent(path)}`, { method: "DELETE" })
        .then((r) => r.json()),

    createPty: (cwd?: string) =>
      fetch(`${API}/api/sandbox/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: cwd ?? "/workspace" }),
      }).then((r) => r.json()),
  }), []);
}

export function getSandboxWsUrl(sessionId: string): string {
  const base = API.replace(/^http/, "ws");
  return `${base}/api/sandbox/pty/${sessionId}/ws`;
}
