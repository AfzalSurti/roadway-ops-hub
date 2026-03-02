import { ReportStatus } from "@prisma/client";
import { z } from "zod";

export const createReportSchema = z.object({
  taskId: z.string().min(1),
  reportTemplateId: z.string().min(1),
  submission: z.record(z.any())
});

export const updateReportStatusSchema = z.object({
  status: z.enum([ReportStatus.APPROVED, ReportStatus.CHANGES_REQUESTED, ReportStatus.REJECTED])
});

export const updateReportFeedbackSchema = z.object({
  adminFeedback: z.string().min(1)
});