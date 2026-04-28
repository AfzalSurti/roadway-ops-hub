import { z } from "zod";

const assistantActionSchema = z.enum([
  "CREATE_PROJECT",
  "CREATE_TASK",
  "CREATE_EMPLOYEE",
  "ADD_COMMENT",
  "LIST_COMMENTS",
  "CREATE_TEMPLATE",
  "UPDATE_TEMPLATE",
  "DELETE_TEMPLATE",
  "LIST_TEMPLATES",
  "LIST_PROJECTS",
  "LIST_TASKS",
  "EMPLOYEE_PERFORMANCE",
  "PENDING_TASKS_MONTH",
  "SHOW_PENDING_TASK_DETAILS",
  "DOWNLOAD_EMPLOYEE_REPORT",
  "LIST_NOTIFICATIONS",
  "MARK_NOTIFICATION_READ",
  "MARK_ALL_NOTIFICATIONS_READ",
  "HELP",
  "UNKNOWN"
]);

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
    .default([]),
  draft: z
    .object({
      action: assistantActionSchema,
      arguments: z.record(z.unknown()).optional().default({}),
      missingFields: z.array(z.string().trim().min(1)).optional().default([])
    })
    .optional()
});
