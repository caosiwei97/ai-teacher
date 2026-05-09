import { z } from 'zod';

export const MessageRole = z.enum(["tutor", "learner", "system"]);
export const MessageType = z.enum([
  "text",
  "quiz",
  "quiz_response",
  "assessment",
  "system",
]);
export const MessageStatus = z.enum([
  "sending",
  "processing",
  "completed",
  "failed",
]);

export const AssessmentPayload = z.object({
  success: z.boolean(),
  conceptId: z.string(),
  summary: z.string(),
  reviewTable: z.array(
    z.object({
      points: z.string(),
      yourAnswer: z.string(),
      accuracy: z.string(),
    }),
  ),
  coreTags: z.array(z.string()),
  nextNodeTitle: z.string(),
});

export const CreateMessageInput = z.object({
  sessionId: z.string(),
  role: MessageRole,
  type: MessageType,
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type MessageRole = z.infer<typeof MessageRole>;
export type MessageType = z.infer<typeof MessageType>;
export type MessageStatus = z.infer<typeof MessageStatus>;
export type AssessmentPayload = z.infer<typeof AssessmentPayload>;
export type CreateMessageInput = z.infer<typeof CreateMessageInput>;
