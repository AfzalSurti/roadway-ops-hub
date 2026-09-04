import { z } from "zod";

const leaveType = z.enum(["FULL_DAY", "HALF_DAY", "SHORT_LEAVE"]);

export const createLeaveRequestSchema = z.object({
  date: z.string().min(1, "Date is required"),
  leaveType
});

export const createOvertimeRequestSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    hours: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0).max(59)
  })
  .superRefine((value, ctx) => {
    if (value.hours === 0 && value.minutes === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Overtime duration must be greater than 0",
        path: ["minutes"]
      });
    }
  });

export const reviewRequestSchema = z.object({
  rejectionReason: z.string().trim().max(1000).optional()
});
