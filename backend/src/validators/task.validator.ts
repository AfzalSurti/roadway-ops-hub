import { Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(2),
  description: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(2).optional()
  ),
  projectCode: z.string().trim().min(1).optional(),
  projectNumber: z.string().trim().min(1).optional(),
  project: z.string().min(2),
  allocatedAt: z.coerce.date(),
  allottedDays: z.coerce.number().int().positive().optional(),
  ratingEnabled: z.boolean().optional(),
  assignedToId: z.string().min(1),
  reportTemplateId: z.string().min(1).optional()
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().min(2).optional(),
    projectCode: z.string().trim().min(1).optional(),
    projectNumber: z.string().trim().min(1).optional(),
    project: z.string().min(2).optional(),
    dueDate: z.coerce.date().optional(),
    allocatedAt: z.coerce.date().nullable().optional(),
    allottedDays: z.coerce.number().int().positive().nullable().optional(),
    ratingEnabled: z.boolean().optional(),
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