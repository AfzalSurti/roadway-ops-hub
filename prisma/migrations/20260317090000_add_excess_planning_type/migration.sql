-- Add planning type to support NORMAL and EXCESS workflows

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinancialPlanningType" AS ENUM ('NORMAL', 'EXCESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns with backward-compatible defaults
ALTER TABLE "ProjectFinancialItem"
  ADD COLUMN IF NOT EXISTS "planningType" "FinancialPlanningType" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE "ProjectFinancialRaBill"
  ADD COLUMN IF NOT EXISTS "planningType" "FinancialPlanningType" NOT NULL DEFAULT 'NORMAL';

-- Replace unique index so item numbers can repeat across NORMAL/EXCESS plans
DROP INDEX IF EXISTS "ProjectFinancialItem_planId_itemNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFinancialItem_planId_itemNumber_planningType_key"
  ON "ProjectFinancialItem"("planId", "itemNumber", "planningType");

-- Supporting indexes
DROP INDEX IF EXISTS "ProjectFinancialItem_planId_idx";
CREATE INDEX IF NOT EXISTS "ProjectFinancialItem_planId_planningType_idx"
  ON "ProjectFinancialItem"("planId", "planningType");

DROP INDEX IF EXISTS "ProjectFinancialRaBill_planId_idx";
CREATE INDEX IF NOT EXISTS "ProjectFinancialRaBill_planId_planningType_idx"
  ON "ProjectFinancialRaBill"("planId", "planningType");
