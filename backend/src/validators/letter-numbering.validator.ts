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

const refineReplyTracking = (
  value: { category?: "INWARD" | "OUTWARD" | "OTHER"; needsReply?: boolean | null },
  ctx: z.RefinementCtx
) => {
  if (value.category === "OUTWARD" && value.needsReply === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reply tracking applies only to Inward / Other letters",
      path: ["needsReply"]
    });
  }
};

const createLetterEntryObjectSchema = z.object({
  category: letterCategory,
  letterDate: optionalDate.optional(),
  sentBy: z.string().trim().max(500).optional(),
  sentTo: z.string().trim().max(500).optional(),
  subject: z.string().trim().max(2000).optional(),
  ccTo: z.string().trim().max(1000).optional(),
  subjectCategory: z.string().trim().max(200).optional(),
  letterLinkUrl: z.string().trim().max(2000).nullable().optional(),
  /** Inward/Other only: must we reply to this letter? */
  needsReply: z.boolean().nullable().optional(),
  /** Mark reply completed (true) or reopen (false) */
  replied: z.boolean().optional()
});

export const createLetterEntrySchema = createLetterEntryObjectSchema.superRefine(refineReplyTracking);

export const updateLetterEntrySchema = z
  .object({
    category: letterCategory.optional(),
    letterDate: optionalDate.optional(),
    sentBy: z.string().trim().max(500).optional(),
    sentTo: z.string().trim().max(500).optional(),
    subject: z.string().trim().max(2000).optional(),
    ccTo: z.string().trim().max(1000).optional(),
    subjectCategory: z.string().trim().max(200).optional(),
    letterLinkUrl: z.string().trim().max(2000).nullable().optional(),
    needsReply: z.boolean().nullable().optional(),
    replied: z.boolean().optional()
  })
  .superRefine(refineReplyTracking);

export const insertLetterEntrySchema = createLetterEntryObjectSchema
  .extend({
    afterLetterId: z.string().min(1, "Reference letter is required")
  })
  .superRefine(refineReplyTracking);

export const letterSuggestionsQuerySchema = z.object({
  field: z.enum(["sentBy", "sentTo", "subject", "ccTo"]),
  q: z.string().optional(),
  letterProjectId: z.string().optional()
});
