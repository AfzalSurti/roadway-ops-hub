-- Per-person deduction percentage on professional staff contract amounts.

-- AlterTable
ALTER TABLE "ProjectFinancialProfession" ADD COLUMN "deductionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
