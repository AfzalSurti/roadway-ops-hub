-- Leave + Overtime ("Calculate Hours") module

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('FULL_DAY', 'HALF_DAY', 'SHORT_LEAVE');

-- CreateEnum
CREATE TYPE "HoursRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CalculationPeriodStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "CalculationPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CalculationPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CalculationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "calculationPeriodId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "HoursRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "calculationPeriodId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "HoursRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalculationPeriod_startDate_endDate_key" ON "CalculationPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CalculationPeriod_status_idx" ON "CalculationPeriod"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_date_idx" ON "LeaveRequest"("employeeId", "date");

-- CreateIndex
CREATE INDEX "LeaveRequest_calculationPeriodId_status_idx" ON "LeaveRequest"("calculationPeriodId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_date_idx" ON "OvertimeRequest"("employeeId", "date");

-- CreateIndex
CREATE INDEX "OvertimeRequest_calculationPeriodId_status_idx" ON "OvertimeRequest"("calculationPeriodId", "status");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_status_idx" ON "OvertimeRequest"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_calculationPeriodId_fkey" FOREIGN KEY ("calculationPeriodId") REFERENCES "CalculationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_calculationPeriodId_fkey" FOREIGN KEY ("calculationPeriodId") REFERENCES "CalculationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
