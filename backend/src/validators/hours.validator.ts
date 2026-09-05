import { z } from "zod";

const leaveType = z.enum(["FULL_DAY", "HALF_DAY", "SHORT_LEAVE"]);
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:mm time");

export const createLeaveRequestSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  leaveType,
  reason: z.string().trim().min(1, "Reason is required").max(1000)
});

export const createOvertimeRequestSchema = z.object({
  date: z.string().min(1, "Date is required"),
  project: z.string().trim().min(1, "Project is required").max(200),
  startTime: timeOfDay,
  endTime: timeOfDay,
  reason: z.string().trim().min(1, "Reason is required").max(1000)
});

export const reviewRequestSchema = z.object({
  rejectionReason: z.string().trim().max(1000).optional()
});

export const convertLeaveSchema = z.object({
  periodId: z.string().min(1, "Calculation period is required"),
  reason: z.string().trim().min(1, "Reason is required").max(1000)
});
