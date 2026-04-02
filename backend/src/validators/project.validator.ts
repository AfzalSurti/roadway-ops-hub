import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional(),
  projectNumber: z.string().trim().min(1).optional()
});

export const updateProjectSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    projectNumber: z.string().trim().min(1).optional(),
    projectCodePrefix: z.string().trim().min(1).optional(),
    companyCode: z.string().trim().min(1).optional(),
    technicalUnitCode: z.string().trim().min(1).optional(),
    subTechnicalUnitCode: z.string().trim().min(1).optional(),
    workCategoryCode: z.string().trim().min(1).optional(),
    financialYearShort: z.coerce.number().int().min(0).max(99).optional(),
    serialNumber: z.coerce.number().int().min(1).optional(),
    projectNumberAssignedAt: z.coerce.date().optional()
  })
  .refine((payload) => Object.keys(payload).length > 0, "At least one field is required");

const companyCodeSchema = z.enum(["G", "S", "I", "H"]);
const technicalUnitCodeSchema = z.enum(["T", "S", "D"]);
const subTechnicalUnitCodeSchema = z.enum([
  "GE",
  "MT",
  "LT",
  "CE",
  "ND",
  "AE",
  "IE",
  "PM",
  "TP",
  "PC",
  "FH",
  "RS",
  "EA",
  "AR",
  "ST",
  "BM",
  "UD",
  "QS",
  "EN",
  "GB",
  "BU",
  "IR",
  "IB",
  "IS",
  "MS",
  "DD",
  "HE",
  "TE"
]);

export const previewProjectNumberSchema = z.object({
  companyCode: companyCodeSchema,
  technicalUnitCode: technicalUnitCodeSchema,
  subTechnicalUnitCode: subTechnicalUnitCodeSchema
});

export const assignProjectNumberSchema = previewProjectNumberSchema.extend({
  workCategoryCode: z.enum(["N", "F", "B", "I", "P", "R", "S", "T", "L", "M", "C", "G", "D"])
});

export const upsertFinancialPlanSchema = z.object({
  planningType: z.enum(["NORMAL", "EXCESS"]).optional(),
  items: z.array(
    z.object({
      itemNumber: z.coerce.number().int().min(1).max(999),
      particulars: z.string().trim().min(1),
      percentage: z.coerce.number().min(0).max(100)
    })
  ).min(1, "At least one planning item is required")
});

export const createRaBillSchema = z.object({
  planningType: z.enum(["NORMAL", "EXCESS"]).optional(),
  items: z.array(
    z.object({
      itemId: z.string().trim().min(1),
      billPercentage: z.coerce.number().min(0).max(100)
    })
  ).min(1, "Select at least one item"),
  carryForwards: z.array(
    z.object({
      sourceRaBillId: z.string().trim().min(1),
      amount: z.coerce.number().positive()
    })
  ).optional().default([])
});

export const updateRaBillSchema = z.object({
  status: z.enum(["PLANNING", "PUT_UP", "RECEIVED"]).optional(),
  receivedDate: z.string().optional().nullable(),
  chequeRtgsAmount: z.coerce.number().min(0).optional(),
  itDeductionPct: z.coerce.number().min(0).max(100).optional(),
  lCessDeductionPct: z.coerce.number().min(0).max(100).optional(),
  securityDepositPct: z.coerce.number().min(0).max(100).optional(),
  recoverFromRaBillPct: z.coerce.number().min(0).max(100).optional(),
  gstWithheldPct: z.coerce.number().min(0).max(100).optional(),
  withheldPct: z.coerce.number().min(0).max(100).optional(),
  remark: z.string().trim().max(500).optional().nullable()
});
