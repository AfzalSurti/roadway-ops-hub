-- Split SubStaffInputPlan.plannedDays into separate Construction/DLP buckets, mirroring the
-- Construction/DLP split already used for Staff Balance MM and Suggested Days.
ALTER TABLE "SubStaffInputPlan" ADD COLUMN "plannedDaysConstruction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SubStaffInputPlan" ADD COLUMN "plannedDaysDlp" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Existing data has no recorded phase split — keep the historical total under Construction rather
-- than losing it.
UPDATE "SubStaffInputPlan" SET "plannedDaysConstruction" = "plannedDays";

ALTER TABLE "SubStaffInputPlan" DROP COLUMN "plannedDays";
