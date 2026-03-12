import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional()
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