import { Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  projectCode: z.string().trim().min(1).optional(),
  projectNumber: z.string().trim().min(1).optional(),
  project: z.string().min(2),
  dueDate: z.coerce.date(),
  allottedDays: z.coerce.number().int().positive().optional(),
  priority: z.nativeEnum(Priority),
  assignedToId: z.string().min(1),
  reportTemplateId: z.string().min(1)
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    projectCode: z.string().trim().min(1).optional(),
    projectNumber: z.string().trim().min(1).optional(),
    project: z.string().min(2).optional(),
    dueDate: z.coerce.date().optional(),
    allottedDays: z.coerce.number().int().positive().nullable().optional(),
    submittedForReviewAt: z.coerce.date().nullable().optional(),
    managerReviewComments: z.string().nullable().optional(),
    reviewCompletedAt: z.coerce.date().nullable().optional(),
    actualCompletedAt: z.coerce.date().nullable().optional(),
    completionDays: z.coerce.number().int().nullable().optional(),
    completionDelayDays: z.coerce.number().int().nullable().optional(),
    rating: z.coerce.number().min(0).max(10).nullable().optional(),
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