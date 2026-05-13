import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from 'zod';
import { prisma } from "@ai-teacher/db";
import { submitCode, ensureSandbox } from "../services/sandbox";
import { decrypt } from "../services/crypto.js";

export const sandboxRoute = new Hono();

const executeSchema = z.object({
  source_code: z.string().min(1),
  language_id: z.number().int().positive(),
  stdin: z.string().optional(),
  expected_output: z.string().optional(),
  llmConfigId: z.string().optional(),
});

sandboxRoute.post("/execute", zValidator("json", executeSchema), async (c) => {
  const body = c.req.valid("json");

  let llmConfig: { apiKey: string; baseUrl?: string } | undefined;
  if (body.llmConfigId) {
    const config = await prisma.llmConfig.findUnique({ where: { id: body.llmConfigId } });
    if (config) {
      llmConfig = {
        apiKey: decrypt(config.encryptedKey),
        baseUrl: config.baseUrl ?? undefined,
      };
    }
  }

  try {
    const result = await submitCode({
      source_code: body.source_code,
      language_id: body.language_id,
      stdin: body.stdin,
      expected_output: body.expected_output,
      cpu_time_limit: 5,
      memory_limit: 256000,
      wall_time_limit: 10,
    }, llmConfig);

    return c.json({
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exit_code,
      time: result.time,
      memory: result.memory,
      status: result.status.description,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知沙箱错误";
    return c.json({
      stdout: "",
      stderr: message,
      exitCode: 1,
      time: "0",
      memory: 0,
      status: "Sandbox Error",
    }, 200);
  }
});

// ---------------------------------------------------------------------------
// Proxy helper
// ---------------------------------------------------------------------------

async function proxyToExecd(path: string, init?: RequestInit): Promise<Response> {
  const execdUrl = await ensureSandbox();
  return fetch(`http://${execdUrl}${path}`, init);
}

// ---------------------------------------------------------------------------
// File System APIs
// ---------------------------------------------------------------------------

sandboxRoute.get("/files/search", async (c) => {
  const path = c.req.query("path") ?? "/workspace";
  const pattern = c.req.query("pattern") ?? "";
  const params = new URLSearchParams({ path, ...(pattern && { pattern }) });
  const res = await proxyToExecd(`/files/search?${params}`);
  return c.json(await res.json());
});

sandboxRoute.get("/files/download", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path is required" }, 400);
  const res = await proxyToExecd(`/files/download?path=${encodeURIComponent(path)}`);
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "text/plain" },
  });
});

sandboxRoute.get("/files/content", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path is required" }, 400);
  const res = await proxyToExecd(`/files/download?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    return c.json({ error: `Failed to read file: ${res.status}` }, res.status as 400);
  }
  const content = await res.text();
  return c.json({ content, path });
});

sandboxRoute.post("/files/upload", async (c) => {
  const body = await c.req.raw.clone().arrayBuffer();
  const contentType = c.req.header("Content-Type") ?? "multipart/form-data";
  const res = await proxyToExecd("/files/upload", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
  return c.json(await res.json());
});

sandboxRoute.post("/directories", zValidator("json", z.object({ path: z.string().min(1) })), async (c) => {
  const { path } = c.req.valid("json");
  const res = await proxyToExecd("/directories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return c.json(await res.json());
});

sandboxRoute.delete("/files", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path is required" }, 400);
  const res = await proxyToExecd(`/files?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  return c.json(await res.json());
});

sandboxRoute.delete("/directories", async (c) => {
  const path = c.req.query("path");
  if (!path) return c.json({ error: "path is required" }, 400);
  const res = await proxyToExecd(`/directories?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  return c.json(await res.json());
});

// ---------------------------------------------------------------------------
// PTY Terminal APIs
// ---------------------------------------------------------------------------

sandboxRoute.post("/pty", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const res = await proxyToExecd("/pty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd: body.cwd }),
  });
  return c.json(await res.json());
});

// TODO(pty-ws): Hono on Node.js lacks native WebSocket upgrade for binary frame proxying.
// Fallback: POST /pty/:sessionId/command + GET /pty/:sessionId/output (SSE).
sandboxRoute.get("/pty/:sessionId/ws", async (c) => {
  const nodeReq = (c.env as Record<string, unknown>)?.incoming as import("http").IncomingMessage | undefined;
  const nodeRes = (c.env as Record<string, unknown>)?.outgoing as import("http").ServerResponse | undefined;

  if (!nodeReq || !nodeRes) {
    return c.json({ error: "WebSocket upgrade not available in this runtime" }, 501);
  }

  const sessionId = c.req.param("sessionId");
  const execdUrl = await ensureSandbox();

  try {
    const { WebSocket: WsClient } = await import("ws");
    const { WebSocketServer } = await import("ws");

    const upstream = new WsClient(`ws://${execdUrl}/pty/${sessionId}/ws`);
    const wss = new WebSocketServer({ noServer: true });

    wss.handleUpgrade(nodeReq, nodeReq.socket, Buffer.alloc(0), (clientWs) => {
      upstream.on("message", (data: Buffer | string, isBinary: boolean) => {
        if (clientWs.readyState === WsClient.OPEN) {
          clientWs.send(data, { binary: isBinary });
        }
      });

      clientWs.on("message", (data: Buffer | string, isBinary: boolean) => {
        if (upstream.readyState === WsClient.OPEN) {
          upstream.send(data, { binary: isBinary });
        }
      });

      clientWs.on("close", () => upstream.close());
      upstream.on("close", () => clientWs.close());
      upstream.on("error", () => clientWs.close());
      clientWs.on("error", () => upstream.close());
    });

    return new Response(null, { status: 101 });
  } catch {
    return c.json({
      error: "WebSocket proxy requires 'ws' package. Use POST /pty/:sessionId/command as fallback.",
    }, 501);
  }
});
