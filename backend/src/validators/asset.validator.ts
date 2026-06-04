import { z } from "zod";
import { SURVEY_EQUIPMENT_CLASS } from "../data/default-asset-catalog.js";

export const assetStatusSchema = z.enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "DISPOSED"]);

export const createAssetSchema = z
  .object({
    assetClass: z.string().trim().min(1),
    assetType: z.string().trim().min(1),
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
    itAssetId: z.string().trim().optional().nullable()
  })
  .superRefine((payload, ctx) => {
    if (payload.status === "IN_USE" && !payload.projectNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Project number is required when status is IN_USE",
        path: ["projectNumber"]
      });
    }
    if (payload.status === "IN_STORE" && payload.assetClass !== SURVEY_EQUIPMENT_CLASS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "IN_STORE status is only allowed for Survey Equipment",
        path: ["status"]
      });
    }
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
    itAssetId: z.string().trim().optional().nullable()
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
