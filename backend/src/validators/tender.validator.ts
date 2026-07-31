import { z } from "zod";

export const createTenderBidSchema = z.object({
  nameOfWork: z.string().trim().min(1, "Name of work is required").max(500),
  workCategory: z.string().trim().min(1).max(10),
  client: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  emd: z.number().min(0).optional(),
  tenderFees: z.number().min(0).optional(),
  infraconFees: z.number().min(0).optional(),
  status: z.enum(["ALLOTTED", "NOT_ALLOTTED"]).optional(),
  letterPreviewUrl: z.string().trim().max(1000).nullable().optional(),
  remarks: z.string().trim().max(4000).optional()
});

export const updateTenderBidSchema = z.object({
  nameOfWork: z.string().trim().min(1).max(500).optional(),
  workCategory: z.string().trim().min(1).max(10).optional(),
  client: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().max(100).optional(),
  emd: z.number().min(0).optional(),
  tenderFees: z.number().min(0).optional(),
  infraconFees: z.number().min(0).optional(),
  status: z.enum(["ALLOTTED", "NOT_ALLOTTED"]).optional(),
  letterPreviewUrl: z.string().trim().max(1000).nullable().optional(),
  remarks: z.string().trim().max(4000).optional()
});
