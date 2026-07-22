-- Letter Numbering module (run on Neon if migration not applied yet)

DO $$ BEGIN
  CREATE TYPE "LetterCategory" AS ENUM ('INWARD', 'OUTWARD', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LetterProject" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "projectCoordinator" TEXT NOT NULL DEFAULT '',
    "projectEngineer" TEXT NOT NULL DEFAULT '',
    "linkedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LetterProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LetterEntry" (
    "id" TEXT NOT NULL,
    "letterProjectId" TEXT NOT NULL,
    "sortOrder" DOUBLE PRECISION NOT NULL,
    "serialLabel" TEXT NOT NULL,
    "letterDate" TIMESTAMP(3),
    "letterNumber" TEXT NOT NULL DEFAULT '',
    "category" "LetterCategory" NOT NULL,
    "sentBy" TEXT NOT NULL DEFAULT '',
    "sentTo" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "ccTo" TEXT NOT NULL DEFAULT '',
    "subjectCategory" TEXT NOT NULL DEFAULT '',
    "letterLinkUrl" TEXT,
    "outwardSequence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LetterEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LetterProject_shortName_idx" ON "LetterProject"("shortName");
CREATE INDEX IF NOT EXISTS "LetterProject_linkedProjectId_idx" ON "LetterProject"("linkedProjectId");
CREATE UNIQUE INDEX IF NOT EXISTS "LetterProject_projectNumber_projectCode_key" ON "LetterProject"("projectNumber", "projectCode");
CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_sortOrder_idx" ON "LetterEntry"("letterProjectId", "sortOrder");
CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_category_idx" ON "LetterEntry"("letterProjectId", "category");

DO $$ BEGIN
  ALTER TABLE "LetterProject" ADD CONSTRAINT "LetterProject_linkedProjectId_fkey"
    FOREIGN KEY ("linkedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LetterEntry" ADD CONSTRAINT "LetterEntry_letterProjectId_fkey"
    FOREIGN KEY ("letterProjectId") REFERENCES "LetterProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Reply tracking for Inward / Other letters
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "needsReply" BOOLEAN;
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_needsReply_repliedAt_idx"
  ON "LetterEntry"("letterProjectId", "needsReply", "repliedAt");

-- Reply-of linkage + optional remark
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "replyOfSerial" TEXT;
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "remark" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "LetterEntry_letterProjectId_replyOfSerial_idx"
  ON "LetterEntry"("letterProjectId", "replyOfSerial");
