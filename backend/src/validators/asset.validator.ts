import { z } from "zod";
export const assetStatusSchema = z.enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "DISPOSED"]);

export const createAssetSchema = z.object({
  assetClass: z.string().trim().optional().default("Unclassified"),
  assetType: z.string().trim().optional().default("Other"),
  markModel: z.string().trim().optional().nullable(),
  dateOfPurchase: z.coerce.date().optional().nullable(),
  warrantyPeriod: z.string().trim().optional().nullable(),
  purchaseAmount: z.coerce.number().min(0).default(0),
  gst: z.coerce.number().min(0).default(0),
  projectNumber: z.string().trim().optional().nullable(),
  projectName: z.string().trim().optional().nullable(),
  assignedUser: z.string().trim().optional().nullable(),
  assignedDate: z.coerce.date().optional().nullable(),
  status: assetStatusSchema.optional().default("IN_USE"),
  soldAmount: z.coerce.number().min(0).optional().nullable(),
  soldRemark: z.string().trim().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  forMonth: z.string().trim().optional().nullable(),
  itAssetId: z.string().trim().optional().nullable(),
  billFileUrl: z.string().trim().optional().nullable(),
  billFileName: z.string().trim().optional().nullable(),
  billMimeType: z.string().trim().optional().nullable()
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
    projectName: z.string().trim().optional().nullable(),
    assignedUser: z.string().trim().optional().nullable(),
    assignedDate: z.coerce.date().optional().nullable(),
    status: assetStatusSchema.optional(),
    soldAmount: z.coerce.number().min(0).optional().nullable(),
    soldRemark: z.string().trim().optional().nullable(),
    remarks: z.string().trim().optional().nullable(),
    forMonth: z.string().trim().optional().nullable(),
    itAssetId: z.string().trim().optional().nullable(),
    billFileUrl: z.string().trim().optional().nullable(),
    billFileName: z.string().trim().optional().nullable(),
    billMimeType: z.string().trim().optional().nullable()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");

export const addMovementSchema = z
  .object({
    movedToProjectNumber: z.string().trim().optional().nullable(),
    movedToProjectName: z.string().trim().optional().nullable(),
    dateOfMoving: z.coerce.date(),
    movedToUser: z.string().trim().optional().nullable(),
    moveToStore: z.boolean().optional().default(false)
  })
  .superRefine((payload, ctx) => {
    if (payload.moveToStore) {
      return;
    }

    if (!payload.movedToProjectNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Moved to project number is required",
        path: ["movedToProjectNumber"]
      });
    }

    if (!payload.movedToProjectName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Moved to project name is required",
        path: ["movedToProjectName"]
      });
    }

    if (!payload.movedToUser?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Moved to user is required",
        path: ["movedToUser"]
      });
    }
  });

export const addMaintenanceSchema = z.object({
  dateOfMaintenance: z.coerce.date(),
  repairCostInclGst: z.coerce.number().min(0).default(0),
  remark: z.string().trim().optional().nullable()
});

export const bulkImportAssetsSchema = z.object({
  rows: z.array(createAssetSchema).min(1, "At least one asset row is required").max(500, "Maximum 500 assets per import")
});
