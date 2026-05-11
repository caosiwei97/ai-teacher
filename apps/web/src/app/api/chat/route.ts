import { NextRequest } from "next/server";

const API_SERVER = process.env.API_SERVER_URL || "http://localhost:38422";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(`${API_SERVER}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
