import type { Context } from "hono";
import { ZodError } from "zod";

export function errorHandler(err: Error, c: Context) {
  console.error("[server] unhandled error:", err);

  if (err instanceof ZodError) {
    return c.json(
      { error: "Invalid request body", details: err.flatten() },
      400,
    );
  }

  return c.json({ error: err.message || "Internal Server Error" }, 500);
}
