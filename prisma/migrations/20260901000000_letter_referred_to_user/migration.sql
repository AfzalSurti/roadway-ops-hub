-- Link Referred To on letter entries to an employee (User) for the employee's own Letter Numbering view
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "referredToUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LetterEntry_referredToUserId_needsReply_repliedAt_idx" ON "LetterEntry"("referredToUserId", "needsReply", "repliedAt");

-- AddForeignKey
ALTER TABLE "LetterEntry" ADD CONSTRAINT "LetterEntry_referredToUserId_fkey" FOREIGN KEY ("referredToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
