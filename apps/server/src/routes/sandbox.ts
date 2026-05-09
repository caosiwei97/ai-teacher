import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { submitCode } from "../services/sandbox";

export const sandboxRoute = new Hono();

const executeSchema = z.object({
  source_code: z.string().min(1),
  language_id: z.number().int().positive(),
  stdin: z.string().optional(),
  expected_output: z.string().optional(),
});

sandboxRoute.post("/execute", zValidator("json", executeSchema), async (c) => {
  const body = c.req.valid("json");

  const result = await submitCode({
    source_code: body.source_code,
    language_id: body.language_id,
    stdin: body.stdin,
    expected_output: body.expected_output,
    cpu_time_limit: 5,
    memory_limit: 256000,
    wall_time_limit: 10,
  });

  return c.json({
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exit_code,
    time: result.time,
    memory: result.memory,
    status: result.status.description,
  });
});
