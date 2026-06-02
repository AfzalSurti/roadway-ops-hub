import { z } from "zod";

export const assetStatusSchema = z.enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "DISPOSED"]);

export const createAssetSchema = z.object({
  assetClass: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  markModel: z.string().trim().optional().nullable(),
  dateOfPurchase: z.coerce.date().optional().nullable(),
  warrantyPeriod: z.string().trim().optional().nullable(),
  purchaseAmount: z.coerce.number().min(0).default(0),
  gst: z.coerce.number().min(0).default(0),
  projectNumber: z.string().trim().optional().nullable(),
  assignedUser: z.string().trim().optional().nullable(),
  status: assetStatusSchema.optional().default("IN_USE"),
  remarks: z.string().trim().optional().nullable(),
  forMonth: z.string().trim().optional().nullable(),
  itAssetId: z.string().trim().optional().nullable()
});

export const updateAssetSchema = z
  .object({
    assetClass: z.string().trim().min(1).optional(),
    assetType: z.string().trim().min(1).optional(),
    markModel: z.string().trim().optional().nullable(),
    dateOfPurchase: z.coerce.date().optional().nullable(),
    warrantyPeriod: z.string().trim().optional().nullable(),
    purchaseAmount: z.coerce.number().min(0).optional(),
    gst: z.coerce.number().min(0).optional(),
    projectNumber: z.string().trim().optional().nullable(),
    assignedUser: z.string().trim().optional().nullable(),
    status: assetStatusSchema.optional(),
    remarks: z.string().trim().optional().nullable(),
    forMonth: z.string().trim().optional().nullable(),
    itAssetId: z.string().trim().optional().nullable()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");

export const addMovementSchema = z.object({
  movedToProjectNumber: z.string().trim().optional().nullable(),
  dateOfMoving: z.coerce.date(),
  movedToUser: z.string().trim().optional().nullable()
});

export const addMaintenanceSchema = z.object({
  dateOfMaintenance: z.coerce.date(),
  repairCostInclGst: z.coerce.number().min(0).default(0),
  sellAmount: z.coerce.number().min(0).default(0),
  soldTo: z.string().trim().min(2).optional().nullable(),
  remark: z.string().trim().optional().nullable()
}).refine((payload) => (payload.sellAmount ?? 0) <= 0 || Boolean(payload.soldTo?.trim()), {
  message: "Sold To is required when Sell Amount is entered",
  path: ["soldTo"]
});
