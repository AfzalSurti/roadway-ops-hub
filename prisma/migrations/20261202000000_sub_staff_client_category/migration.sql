-- Separate client categories (MORTH / NHAI / NH Division / Other) — these differ in how attendance
-- itself is tracked (e.g. MORTH is offline, NHAI is online), so they need their own board, not one
-- mixed list.
CREATE TYPE "SubStaffClientCategory" AS ENUM ('MORTH', 'NHAI', 'NH_DIVISION', 'OTHER');

ALTER TABLE "SubStaffAssignment"
  ADD COLUMN "clientCategory" "SubStaffClientCategory" NOT NULL DEFAULT 'OTHER';

-- Backfill existing rows from their site name, since the register's own naming already distinguishes
-- MORTH/NHAI sites (e.g. "MORTH NANDYAL", "NHAI STANDALONE") — anything else stays OTHER until someone
-- re-categorizes it (e.g. to NH Division).
UPDATE "SubStaffAssignment" SET "clientCategory" = 'MORTH' WHERE "siteName" ILIKE '%morth%';
UPDATE "SubStaffAssignment" SET "clientCategory" = 'NHAI' WHERE "siteName" ILIKE '%nhai%';
