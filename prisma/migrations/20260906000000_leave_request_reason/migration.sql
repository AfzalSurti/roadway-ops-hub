-- Leave requests now capture a reason, matching overtime requests
ALTER TABLE "LeaveRequest" ADD COLUMN "reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LeaveRequest" ALTER COLUMN "reason" DROP DEFAULT;
