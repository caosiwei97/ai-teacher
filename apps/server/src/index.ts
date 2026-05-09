import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { errorHandler } from "./middleware/error-handler";
import { sessionsRoute } from "./routes/sessions";
import { sessionDetailRoute } from "./routes/session-detail";
import { diagnosticRoute } from "./routes/diagnostic";
import { suggestedTopicsRoute } from "./routes/suggested-topics";
import { suggestReplyRoute } from "./routes/suggest-reply";
import { quickQuestionRoute } from "./routes/quick-question";
import { chatRoute } from "./routes/chat";
import { sandboxRoute } from "./routes/sandbox";

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

const port = Number(process.env.SERVER_PORT) || 38422;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] Hono API server running on http://localhost:${info.port}`);
});
