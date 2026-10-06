-- Credit note columns: Claimed minus Passed, its GST, and the credit-note total.
ALTER TABLE "ProjectBillingEntry" ADD COLUMN "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProjectBillingEntry" ADD COLUMN "creditGst" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProjectBillingEntry" ADD COLUMN "creditTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
