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
    const text = String(value).trim();
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid letter date (use dd/mm/yyyy)" });
        return z.NEVER;
      }
      return date.toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
    }
    const normalized = text.includes("T") ? text : `${text}T12:00:00.000Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid letter date (use dd/mm/yyyy)" });
      return z.NEVER;
    }
    if (
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0
    ) {
      return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0)
      ).toISOString();
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
  referredTo: z.string().trim().max(1000).optional(),
  subjectCategory: z.string().trim().max(200).optional(),
  letterLinkUrl: z.string().trim().max(2000).nullable().optional(),
  /** Inward/Other only: must we reply to this letter? */
  needsReply: z.boolean().nullable().optional(),
  /** Mark reply completed (true) or reopen (false) */
  replied: z.boolean().optional(),
  /** Serial of the letter this row replies to (e.g. "2a") */
  replyOfSerial: z.string().trim().max(40).nullable().optional(),
  remark: z.string().trim().max(4000).optional(),
  /** Existing Sr No when importing old letters */
  serialLabel: z.string().trim().max(40).nullable().optional(),
  /** Existing outward sequence for old outward letters */
  outwardSequence: z.string().trim().max(40).nullable().optional(),
  /** Existing letter number as already assigned */
  letterNumber: z.string().trim().max(200).nullable().optional()
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
    referredTo: z.string().trim().max(1000).optional(),
    subjectCategory: z.string().trim().max(200).optional(),
    letterLinkUrl: z.string().trim().max(2000).nullable().optional(),
    needsReply: z.boolean().nullable().optional(),
    replied: z.boolean().optional(),
    replyOfSerial: z.string().trim().max(40).nullable().optional(),
    remark: z.string().trim().max(4000).optional(),
    letterNumber: z.string().trim().max(200).nullable().optional()
  })
  .superRefine(refineReplyTracking);

export const insertLetterEntrySchema = createLetterEntryObjectSchema
  .extend({
    afterLetterId: z.string().min(1, "Reference letter is required")
  })
  .superRefine(refineReplyTracking);

export const bulkImportLettersSchema = z.object({
  rows: z
    .array(createLetterEntryObjectSchema.superRefine(refineReplyTracking))
    .min(1, "At least one letter row is required")
    .max(500, "Maximum 500 letters per import")
});

export const letterSuggestionsQuerySchema = z.object({
  field: z.enum(["sentBy", "sentTo", "subject", "ccTo", "referredTo"]),
  q: z.string().optional(),
  letterProjectId: z.string().optional()
});
