-- Employee requests for permission to log overtime on dates from an already-closed calculation period.

-- CreateTable
CREATE TABLE "PastOvertimeAccess" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HoursRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PastOvertimeAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PastOvertimeAccess_employeeId_status_idx" ON "PastOvertimeAccess"("employeeId", "status");

-- CreateIndex
CREATE INDEX "PastOvertimeAccess_status_idx" ON "PastOvertimeAccess"("status");

-- AddForeignKey
ALTER TABLE "PastOvertimeAccess" ADD CONSTRAINT "PastOvertimeAccess_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastOvertimeAccess" ADD CONSTRAINT "PastOvertimeAccess_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
