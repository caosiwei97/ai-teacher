import { z } from 'zod';

export const SessionStatus = z.enum(["active", "diagnosing", "completed", "archived"]);

export const TeachingMode = z.enum(["warm", "strict", "interviewer"]);

export const CreateSessionInput = z.object({
  topic: z.string().min(1),
  sourceId: z.string().optional(),
});

export type SessionStatus = z.infer<typeof SessionStatus>;
export type TeachingMode = z.infer<typeof TeachingMode>;
export type CreateSessionInput = z.infer<typeof CreateSessionInput>;
