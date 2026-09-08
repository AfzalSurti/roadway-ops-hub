-- New ACCOUNTS role, and a link from ContractActivity to the Project it was used to create
-- ("Create Project" action, Contract -> Project autofill).

-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTS';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

-- Fallback for older Postgres without IF NOT EXISTS on enum values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'Role' AND e.enumlabel = 'ACCOUNTS'
     ) THEN
    ALTER TYPE "Role" ADD VALUE 'ACCOUNTS';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "ContractActivity" ADD COLUMN "linkedProjectId" TEXT;

-- CreateIndex
CREATE INDEX "ContractActivity_linkedProjectId_idx" ON "ContractActivity"("linkedProjectId");

-- AddForeignKey
ALTER TABLE "ContractActivity" ADD CONSTRAINT "ContractActivity_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
