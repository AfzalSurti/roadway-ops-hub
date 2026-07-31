import { z } from "zod";

const isoDateOrNull = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.null()]).optional();

export const createPreContractSchema = z.object({
  nameOfWork: z.string().trim().min(1, "Name of work is required").max(500),
  workCategory: z.string().trim().min(1).max(10),
  client: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  tenderBidId: z.string().trim().max(100).optional(),
  awardOfProjectDate: isoDateOrNull,
  awardOfProjectLetterUrl: z.string().trim().max(1000).nullable().optional(),
  securityDepositType: z.enum(["PERFORMANCE_SECURITY", "BANK_GUARANTEE", "FDR"]).nullable().optional(),
  sdBank: z.string().trim().max(200).optional(),
  sdIssuedDate: isoDateOrNull,
  sdNumber: z.string().trim().max(100).optional(),
  sdAmount: z.number().min(0).optional(),
  sdExpiryDate: isoDateOrNull,
  signingAgreementDate: isoDateOrNull,
  signingAgreementLetterUrl: z.string().trim().max(1000).nullable().optional(),
  proceedingOrderDate: isoDateOrNull,
  proceedingOrderLetterUrl: z.string().trim().max(1000).nullable().optional(),
  insurancePolicy: z.string().trim().max(1000).optional(),
  remarks: z.string().trim().max(4000).optional()
});

export const updatePreContractSchema = z.object({
  nameOfWork: z.string().trim().min(1).max(500).optional(),
  workCategory: z.string().trim().min(1).max(10).optional(),
  client: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().max(100).optional(),
  awardOfProjectDate: isoDateOrNull,
  awardOfProjectLetterUrl: z.string().trim().max(1000).nullable().optional(),
  securityDepositType: z.enum(["PERFORMANCE_SECURITY", "BANK_GUARANTEE", "FDR"]).nullable().optional(),
  sdBank: z.string().trim().max(200).optional(),
  sdIssuedDate: isoDateOrNull,
  sdNumber: z.string().trim().max(100).optional(),
  sdAmount: z.number().min(0).optional(),
  sdExpiryDate: isoDateOrNull,
  signingAgreementDate: isoDateOrNull,
  signingAgreementLetterUrl: z.string().trim().max(1000).nullable().optional(),
  proceedingOrderDate: isoDateOrNull,
  proceedingOrderLetterUrl: z.string().trim().max(1000).nullable().optional(),
  insurancePolicy: z.string().trim().max(1000).optional(),
  remarks: z.string().trim().max(4000).optional()
});
