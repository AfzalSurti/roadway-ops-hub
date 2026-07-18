import { z } from "zod";

const letterCategory = z.enum(["INWARD", "OUTWARD", "OTHER"]);

export const createLetterProjectSchema = z.object({
  projectNumber: z.string().trim().min(1, "Project number is required").max(40),
  projectCode: z.string().trim().min(1, "Project code is required").max(40),
  shortName: z.string().trim().min(1, "Short name is required").max(200),
  fullName: z.string().trim().max(4000).optional(),
  projectCoordinator: z.string().trim().max(200).optional(),
  projectEngineer: z.string().trim().max(200).optional(),
  linkedProjectId: z.string().min(1).nullable().optional(),
  syncToMainProject: z.boolean().optional()
});

export const updateLetterProjectSchema = createLetterProjectSchema
  .omit({ linkedProjectId: true, syncToMainProject: true })
  .partial();

export const importLetterProjectSchema = z.object({
  mainProjectId: z.string().min(1, "Main project is required"),
  projectNumber: z.string().trim().min(1).max(40).optional(),
  projectCode: z.string().trim().min(1).max(40).optional(),
  shortName: z.string().trim().min(1).max(200).optional(),
  fullName: z.string().trim().max(4000).optional(),
  projectCoordinator: z.string().trim().max(200).optional(),
  projectEngineer: z.string().trim().max(200).optional()
});

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const normalized = value.includes("T") ? value : `${value}T00:00:00.000Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid letter date" });
      return z.NEVER;
    }
    return date.toISOString();
  });

export const createLetterEntrySchema = z.object({
  category: letterCategory,
  letterDate: optionalDate.optional(),
  sentBy: z.string().trim().max(500).optional(),
  sentTo: z.string().trim().max(500).optional(),
  subject: z.string().trim().max(2000).optional(),
  ccTo: z.string().trim().max(1000).optional(),
  subjectCategory: z.string().trim().max(200).optional(),
  letterLinkUrl: z.string().trim().max(2000).nullable().optional()
});

export const updateLetterEntrySchema = createLetterEntrySchema.partial();

export const insertLetterEntrySchema = createLetterEntrySchema.extend({
  afterLetterId: z.string().min(1, "Reference letter is required")
});

export const letterSuggestionsQuerySchema = z.object({
  field: z.enum(["sentBy", "sentTo", "subject", "ccTo"]),
  q: z.string().optional(),
  letterProjectId: z.string().optional()
});
