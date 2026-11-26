import { z } from "zod";

const numeric = z.coerce.number().optional();
const status = z.enum(["ACTIVE", "LEFT"]);
const clientCategory = z.enum(["MORTH", "NHAI", "NH_DIVISION", "OTHER"]);

export const upsertSubStaffAssignmentSchema = z.object({
  siteName: z.string().trim().max(200).optional(),
  projectId: z.string().min(1).nullable().optional(),
  projectNumber: z.string().trim().max(40).optional(),
  clientCategory: clientCategory.optional(),
  staffName: z.string().trim().max(200).optional(),
  designation: z.string().trim().max(200).optional(),
  coOrdinator: z.string().trim().max(200).optional(),
  rate: numeric,
  constructionPeriodMonths: numeric,
  dlpMonths: numeric,
  eotMonths: numeric,
  totalPeriodMonths: numeric,
  startDate: z.string().trim().max(40).nullable().optional(),
  endDate: z.string().trim().max(40).nullable().optional(),
  lastBilledMonth: z.string().trim().max(40).nullable().optional(),
  lastBilledDate: z.string().trim().max(40).nullable().optional(),
  mmConstruction: numeric,
  mmDlp: numeric,
  mmEot: numeric,
  totalMm: numeric,
  usedMm: numeric,
  remark: z.string().trim().max(2000).optional(),
  status: status.optional()
});

export const bulkImportSubStaffAssignmentsSchema = z.object({
  rows: z.array(upsertSubStaffAssignmentSchema).min(1, "No rows to import")
});

export const setPlanDaySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  field: z.enum(["construction", "dlp"]),
  value: z.coerce.number().min(0).max(31)
});

export const generatePlanSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12)
});
