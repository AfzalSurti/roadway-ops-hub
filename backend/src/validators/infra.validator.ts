import { z } from "zod";

const optionalMonthlyCost = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monthly cost must be a valid number" });
      return z.NEVER;
    }
    if (num < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monthly cost cannot be negative" });
      return z.NEVER;
    }
    if (num > 10_000_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monthly cost is too high" });
      return z.NEVER;
    }
    return Number(num.toFixed(2));
  });

const optionalDaysWorked = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Days worked must be a valid number" });
      return z.NEVER;
    }
    if (num < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Days worked cannot be negative" });
      return z.NEVER;
    }
    if (num > 366) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Days worked cannot exceed 366" });
      return z.NEVER;
    }
    return Number(num.toFixed(2));
  });

export const createInfraTeamMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required").nullable().optional(),
  phone: z.string().min(5).max(20).nullable().optional(),
  manpowerGroup: z.enum(["Key Personnel", "Sub Professional Staff", "Support Staff"]),
  manpowerRole: z.string().min(2, "Manpower role is required"),
  monthlyCost: optionalMonthlyCost.optional(),
  notes: z.string().max(500).nullable().optional()
});

export const updateInfraTeamMemberSchema = createInfraTeamMemberSchema.partial();

export const createProjectAssignmentSchema = z
  .object({
    teamMemberId: z.string().min(1).optional(),
    teamMemberIds: z.array(z.string().min(1)).min(1).optional(),
    /** assign = link to project only; mobilize = set mobilization date */
    mode: z.enum(["assign", "mobilize"]).optional(),
    mobilizedAt: z.string().datetime({ offset: true }).optional().nullable(),
    daysWorked: optionalDaysWorked.optional()
  })
  .superRefine((value, ctx) => {
    const ids = [
      ...(value.teamMemberIds ?? []),
      ...(value.teamMemberId ? [value.teamMemberId] : [])
    ];
    if (ids.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select at least one team member", path: ["teamMemberIds"] });
    }
    const mode = value.mode ?? (value.mobilizedAt ? "mobilize" : "assign");
    if (mode === "mobilize" && !value.mobilizedAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mobilization date is required", path: ["mobilizedAt"] });
    }
  });

export const updateProjectAssignmentSchema = z.object({
  mobilizedAt: z.string().datetime({ offset: true }).optional().nullable(),
  demobilizedAt: z.string().datetime({ offset: true }).optional().nullable(),
  daysWorked: optionalDaysWorked.optional()
});
