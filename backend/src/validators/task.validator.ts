import { Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  project: z.string().min(2),
  dueDate: z.coerce.date(),
  priority: z.nativeEnum(Priority),
  assignedToId: z.string().min(1),
  reportTemplateId: z.string().min(1)
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    project: z.string().min(2).optional(),
    dueDate: z.coerce.date().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    blockedReason: z.string().nullable().optional(),
    assignedToId: z.string().min(1).optional(),
    reportTemplateId: z.string().min(1).optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");

export const employeeTaskUpdateSchema = z
  .object({
    status: z.nativeEnum(TaskStatus).optional(),
    blockedReason: z.string().nullable().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");