-- Employee action workflow on letter entries: assigned action, status, and employee remark
CREATE TYPE "LetterActionType" AS ENUM ('FOLLOW_UP', 'REPLY');
CREATE TYPE "LetterActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CLOSE');

ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "actionType" "LetterActionType";
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "actionStatus" "LetterActionStatus";
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "employeeRemark" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LetterEntry_referredToUserId_actionStatus_idx" ON "LetterEntry"("referredToUserId", "actionStatus");
