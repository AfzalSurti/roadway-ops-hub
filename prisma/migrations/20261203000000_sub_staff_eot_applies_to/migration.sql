-- Extension of Time can extend either the Construction period or the DLP period, depending on the
-- contract — previously always folded into DLP. This makes it an explicit per-assignment choice.
CREATE TYPE "SubStaffEotAppliesTo" AS ENUM ('CONSTRUCTION', 'DLP');

ALTER TABLE "SubStaffAssignment"
  ADD COLUMN "eotAppliesTo" "SubStaffEotAppliesTo" NOT NULL DEFAULT 'DLP';
