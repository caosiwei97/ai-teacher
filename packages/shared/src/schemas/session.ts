import { z } from "zod";

export const SessionStatus = z.enum(["active", "completed", "archived"]);

export const CreateSessionInput = z.object({
  topic: z.string().min(1),
  sourceId: z.string().optional(),
});

export type SessionStatus = z.infer<typeof SessionStatus>;
export type CreateSessionInput = z.infer<typeof CreateSessionInput>;
