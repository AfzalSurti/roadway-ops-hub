import { z } from "zod";

export const createDprOverviewSchema = z.object({
  projectId: z.string().trim().min(1),
  status: z.enum(["NOT_STARTED", "UNDER_PREPARATION", "DRAFT_SUBMITTED", "UNDER_APPROVAL", "APPROVED"]).optional(),
  data: z.any().optional()
});

export const updateDprOverviewSchema = z.object({
  status: z.enum(["NOT_STARTED", "UNDER_PREPARATION", "DRAFT_SUBMITTED", "UNDER_APPROVAL", "APPROVED"]).optional(),
  data: z.any().optional()
}).refine((p) => Object.keys(p).length > 0, "At least one field is required");
