import { z } from "zod";

export const MessageRole = z.enum(["tutor", "learner", "system"]);
export const MessageType = z.enum([
  "text",
  "quiz",
  "quiz_response",
  "assessment",
  "system",
]);

export const CreateMessageInput = z.object({
  sessionId: z.string(),
  role: MessageRole,
  type: MessageType,
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type MessageRole = z.infer<typeof MessageRole>;
export type MessageType = z.infer<typeof MessageType>;
export type CreateMessageInput = z.infer<typeof CreateMessageInput>;
