import { z } from "zod";

const expenseSheetStatusSchema = z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);

export const createExpenseSheetSchema = z.object({
  projectId: z.string().trim().optional().nullable(),
  siteName: z.string().trim().min(1),
  siteIncharge: z.string().trim().min(1),
  totalPersons: z.coerce.number().int().min(1),
  expenseDate: z.coerce.date(),
  mobileNumber: z.string().trim().optional().nullable(),
  bankAccount: z.string().trim().optional().nullable(),
  sheetNumber: z.coerce.number().int().optional().nullable()
});

export const updateExpenseSheetSchema = createExpenseSheetSchema.partial();

export const createExpenseEntrySchema = z.object({
  categoryId: z.string().trim().min(1),
  entryDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1),
  billAvailable: z.boolean(),
  billNumber: z.string().trim().optional().nullable(),
  billAttachmentUrl: z.string().trim().min(1).optional().nullable()
});

export const updateExpenseEntrySchema = createExpenseEntrySchema.partial();

export const reviewExpenseSheetSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().trim().optional().nullable()
});

export const expenseListQuerySchema = z.object({
  employeeId: z.string().optional(),
  projectId: z.string().optional(),
  siteName: z.string().optional(),
  status: expenseSheetStatusSchema.optional(),
  categoryId: z.string().optional(),
  billAvailable: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});
