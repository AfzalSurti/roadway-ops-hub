import { z } from "zod";

export const chatAssistantSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1)
      })
    )
    .max(20)
    .optional()
    .default([])
});
