-- Rename commencementDate -> startDate, add an editable endDate, drop the unused leftDate.
ALTER TABLE "SubStaffAssignment" RENAME COLUMN "commencementDate" TO "startDate";
ALTER TABLE "SubStaffAssignment" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "SubStaffAssignment" DROP COLUMN "leftDate";
