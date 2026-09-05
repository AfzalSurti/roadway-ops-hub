-- Admin can immediately excuse a single approved leave from needing overtime coverage
-- ("Obedient Leave"), with a reason, independent of whether the calculation period has closed.

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "obedientReason" TEXT,
ADD COLUMN "obedientById" TEXT,
ADD COLUMN "obedientAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_obedientById_fkey" FOREIGN KEY ("obedientById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
