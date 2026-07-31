import { z } from "zod";

const isoDateOrNull = z.union([z.string().datetime({ offset: true }), z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.null()]).optional();

const tenderBidFields = {
  nameOfWork: z.string().trim().min(1, "Name of work is required").max(500),
  nameOfBidder: z.string().trim().max(300).optional(),
  bidInvitingAuthority: z.string().trim().max(500).optional(),
  bidInvitingAuthorityAddress: z.string().trim().max(1000).optional(),
  tenderId: z.string().trim().max(100).optional(),
  projectLengthKm: z.number().min(0).optional(),
  workCategory: z.string().trim().min(1).max(10),
  client: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  emd: z.number().min(0).optional(),
  emdType: z.string().trim().max(100).optional(),
  emdBank: z.string().trim().max(200).optional(),
  emdIssuedDate: isoDateOrNull,
  emdNumber: z.string().trim().max(100).optional(),
  emdValidUpto: isoDateOrNull,
  emdLetterUrl: z.string().trim().max(1000).nullable().optional(),
  tenderFees: z.number().min(0).optional(),
  infraconFees: z.number().min(0).optional(),
  status: z.enum(["ALLOTTED", "NOT_ALLOTTED"]).optional(),
  letterPreviewUrl: z.string().trim().max(1000).nullable().optional(),
  remarks: z.string().trim().max(4000).optional(),
};

export const createTenderBidSchema = z.object(tenderBidFields);

export const updateTenderBidSchema = z.object(
  Object.fromEntries(
    Object.entries(tenderBidFields).map(([k, v]) => [k, v.optional()])
  )
);
