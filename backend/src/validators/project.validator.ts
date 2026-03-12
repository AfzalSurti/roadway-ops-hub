import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  description: z.string().optional()
});

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