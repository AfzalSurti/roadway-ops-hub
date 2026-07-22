-- Reply-of link + optional remark on letter entries
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "replyOfSerial" TEXT;
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "remark" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_replyOfSerial_idx"
  ON "LetterEntry"("letterProjectId", "replyOfSerial");
