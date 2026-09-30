import { z } from "zod";

const numeric = z.coerce.number().optional();

export const upsertBillingEntrySchema = z.object({
  date: z.string().trim().max(40).nullable().optional(),
  raBillNo: z.string().trim().max(100).optional(),
  billNo: z.string().trim().max(100).optional(),
  month: z.string().trim().max(60).optional(),
  basicAmountClaimed: numeric,
  basicAmountPassed: numeric,
  gstAmount: numeric,
  totalAmount: numeric,
  tds: numeric,
  sdRetention: numeric,
  gstDeduction: numeric,
  amountToReceive: numeric,
  chequeAmount: numeric,
  amountHold: numeric,
  gstReceived: numeric
});
