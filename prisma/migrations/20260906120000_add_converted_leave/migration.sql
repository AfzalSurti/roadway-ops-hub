-- Admin "Convert to Leave" settlement: converts an employee's uncovered leave balance into a
-- recorded deduction once a calculation period has ended. Original leave/overtime rows are untouched.

-- CreateTable
CREATE TABLE "ConvertedLeave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "calculationPeriodId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "convertedById" TEXT NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConvertedLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConvertedLeave_employeeId_calculationPeriodId_idx" ON "ConvertedLeave"("employeeId", "calculationPeriodId");

-- CreateIndex
CREATE INDEX "ConvertedLeave_calculationPeriodId_idx" ON "ConvertedLeave"("calculationPeriodId");

-- AddForeignKey
ALTER TABLE "ConvertedLeave" ADD CONSTRAINT "ConvertedLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertedLeave" ADD CONSTRAINT "ConvertedLeave_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvertedLeave" ADD CONSTRAINT "ConvertedLeave_calculationPeriodId_fkey" FOREIGN KEY ("calculationPeriodId") REFERENCES "CalculationPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
