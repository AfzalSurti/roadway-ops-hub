-- LeaveRequest: single date -> continuous date range
ALTER TABLE "LeaveRequest" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN "numberOfDays" INTEGER NOT NULL DEFAULT 1;

UPDATE "LeaveRequest" SET "startDate" = "date", "endDate" = "date" WHERE "startDate" IS NULL;

ALTER TABLE "LeaveRequest" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "LeaveRequest" ALTER COLUMN "endDate" SET NOT NULL;

DROP INDEX IF EXISTS "LeaveRequest_employeeId_date_idx";
ALTER TABLE "LeaveRequest" DROP COLUMN "date";

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_startDate_endDate_idx" ON "LeaveRequest"("employeeId", "startDate", "endDate");

-- OvertimeRequest: add project / start-end time / reason
ALTER TABLE "OvertimeRequest" ADD COLUMN "project" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OvertimeRequest" ADD COLUMN "startTime" TIMESTAMP(3);
ALTER TABLE "OvertimeRequest" ADD COLUMN "endTime" TIMESTAMP(3);
ALTER TABLE "OvertimeRequest" ADD COLUMN "reason" TEXT NOT NULL DEFAULT '';

UPDATE "OvertimeRequest"
SET "startTime" = "date", "endTime" = "date" + ("durationMinutes" || ' minutes')::interval
WHERE "startTime" IS NULL;

ALTER TABLE "OvertimeRequest" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "OvertimeRequest" ALTER COLUMN "endTime" SET NOT NULL;
ALTER TABLE "OvertimeRequest" ALTER COLUMN "project" DROP DEFAULT;
ALTER TABLE "OvertimeRequest" ALTER COLUMN "reason" DROP DEFAULT;
