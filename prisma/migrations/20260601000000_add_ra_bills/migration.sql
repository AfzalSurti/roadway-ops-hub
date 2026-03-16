-- Add raBills relation to ProjectFinancialPlan and create RA bill models

-- CreateTable
CREATE TABLE "ProjectFinancialRaBill" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "totalBillAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedDate" TIMESTAMP(3),
    "chequeRtgsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itDeductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lCessDeductionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lCessDeductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityDepositPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityDepositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recoverFromRaBillPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recoverFromRaBillAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstWithheldPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstWithheldAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withheldPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withheldAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReceivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFinancialRaBill_pkey" PRIMARY KEY ("id")
);

-- Add new fields to ProjectFinancialBill
ALTER TABLE "ProjectFinancialBill"
    ADD COLUMN "raBillId" TEXT,
    ADD COLUMN "billPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- For existing rows, create a placeholder raBillId (handled by db push on fresh deploys)

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFinancialRaBill_planId_billName_key" ON "ProjectFinancialRaBill"("planId", "billName");

-- CreateIndex
CREATE INDEX "ProjectFinancialRaBill_planId_idx" ON "ProjectFinancialRaBill"("planId");

-- CreateIndex
CREATE INDEX "ProjectFinancialRaBill_status_idx" ON "ProjectFinancialRaBill"("status");

-- CreateIndex
CREATE INDEX "ProjectFinancialBill_raBillId_idx" ON "ProjectFinancialBill"("raBillId");

-- AddForeignKey
ALTER TABLE "ProjectFinancialRaBill" ADD CONSTRAINT "ProjectFinancialRaBill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectFinancialPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFinancialBill" ADD CONSTRAINT "ProjectFinancialBill_raBillId_fkey" FOREIGN KEY ("raBillId") REFERENCES "ProjectFinancialRaBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
