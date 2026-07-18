-- AlterTable
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "needsReply" BOOLEAN;
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_needsReply_repliedAt_idx"
  ON "LetterEntry"("letterProjectId", "needsReply", "repliedAt");
