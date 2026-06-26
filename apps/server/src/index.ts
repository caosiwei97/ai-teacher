import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createAdaptorServer } from "@hono/node-server";
import { WebSocket as WsClient, WebSocketServer } from "ws";
import { errorHandler } from "./middleware/error-handler";
import { sessionsRoute } from "./routes/sessions";
import { sessionDetailRoute } from "./routes/session-detail";
import { diagnosticRoute } from "./routes/diagnostic";
import { suggestedTopicsRoute } from "./routes/suggested-topics";
import { suggestReplyRoute } from "./routes/suggest-reply";
import { quickQuestionRoute } from "./routes/quick-question";
import { chatRoute } from "./routes/chat";
import { sandboxRoute } from "./routes/sandbox";
import { llmConfigRoute } from "./routes/llm-config";
import { sourcesRoute } from "./routes/sources";
import { cleanupOrphanSandboxes, ensureSandbox, registerShutdownHook } from "./services/sandbox";
import { ensureBucket } from "@ai-teacher/shared/services/storage";

const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: "http://localhost:38421", credentials: true }));
app.onError(errorHandler);

// Mount more specific routes before less specific ones
app.route("/api/sessions/:sessionId/diagnostic", diagnosticRoute);
app.route("/api/sessions/:sessionId", sessionDetailRoute);
app.route("/api/sessions", sessionsRoute);
app.route("/api/suggested-topics", suggestedTopicsRoute);
app.route("/api/suggest-reply", suggestReplyRoute);
app.route("/api/quick-question", quickQuestionRoute);
app.route("/api/chat", chatRoute);
app.route("/api/sandbox", sandboxRoute);
app.route("/api/llm", llmConfigRoute);
app.route("/api/sources", sourcesRoute);

const port = Number(process.env.SERVER_PORT) || 38422;

const server = createAdaptorServer({ fetch: app.fetch, port });

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  const match = req.url?.match(/^\/api\/sandbox\/pty\/([^/]+)\/ws/);
  if (!match) {
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (origin && origin !== "http://localhost:38421") {
    socket.destroy();
    return;
  }

  const sessionId = match[1];

  try {
    const execdUrl = await ensureSandbox();
    const upstream = new WsClient(`ws://${execdUrl}/pty/${sessionId}/ws`);

    upstream.on("open", () => {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
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
    });

    upstream.on("error", () => {
      socket.destroy();
    });
  } catch {
    socket.destroy();
  }
});

server.listen(port, async () => {
  registerShutdownHook();
  const cleaned = await cleanupOrphanSandboxes();
  if (cleaned > 0) console.log(`[server] Cleaned up ${cleaned} orphan sandbox(es)`);
  // MinIO bucket 幂等创建（fire-and-forget：失败仅日志，不阻断 server 启动）
  ensureBucket().catch((err) => console.error(`[storage] ensureBucket failed: ${err.message}`));
  console.log(`[server] Hono API server running on http://localhost:${port}`);
});
