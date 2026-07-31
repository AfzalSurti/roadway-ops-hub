import { z } from "zod";

const isoDateOrNull = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.null()]).optional();
const sdTypeEnum = z.enum(["PERFORMANCE_SECURITY", "BANK_GUARANTEE", "FDR", "SECURITY_BOND"]).nullable().optional();

const contractFields = {
  nameOfWork: z.string().trim().min(1, "Name of work is required").max(500),
  nameOfBidder: z.string().trim().max(300).optional(),
  bidInvitingAuthority: z.string().trim().max(500).optional(),
  bidInvitingAuthorityAddress: z.string().trim().max(1000).optional(),
  workCategory: z.string().trim().min(1).max(10),
  client: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  tenderBidId: z.string().trim().max(100).optional(),
  securityDepositType: sdTypeEnum,
  sdBank: z.string().trim().max(200).optional(),
  sdIssuedDate: isoDateOrNull,
  sdNumber: z.string().trim().max(100).optional(),
  sdAmount: z.number().min(0).optional(),
  sdExpiryDate: isoDateOrNull,
  sdLetterUrl: z.string().trim().max(1000).nullable().optional(),
  additionalSdType: sdTypeEnum,
  additionalSdBank: z.string().trim().max(200).optional(),
  additionalSdIssuedDate: isoDateOrNull,
  additionalSdNumber: z.string().trim().max(100).optional(),
  additionalSdAmount: z.number().min(0).optional(),
  additionalSdExpiryDate: isoDateOrNull,
  additionalSdLetterUrl: z.string().trim().max(1000).nullable().optional(),
  proceedingOrderDate: isoDateOrNull,
  proceedingOrderLetterUrl: z.string().trim().max(1000).nullable().optional(),
  woAmount: z.number().min(0).optional(),
  piPlPolicyNo: z.string().trim().max(200).optional(),
  piPlPolicyDate: isoDateOrNull,
  piPlPolicyAmount: z.number().min(0).optional(),
  piPlPolicyIssueDate: isoDateOrNull,
  piPlPolicyExpiryDate: isoDateOrNull,
  piPlPolicyLetterUrl: z.string().trim().max(1000).nullable().optional(),
  wcPolicyNo: z.string().trim().max(200).optional(),
  wcPolicyDate: isoDateOrNull,
  wcPolicyAmount: z.number().min(0).optional(),
  wcPolicyIssueDate: isoDateOrNull,
  wcPolicyExpiryDate: isoDateOrNull,
  wcPolicyLetterUrl: z.string().trim().max(1000).nullable().optional(),
  remarks: z.string().trim().max(4000).optional(),
};

export const createContractSchema = z.object(contractFields);

export const updateContractSchema = z.object(
  Object.fromEntries(
    Object.entries(contractFields).map(([k, v]) => [k, v.optional()])
  )
);
