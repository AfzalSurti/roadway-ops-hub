-- Intermediate / sub-professional staff deployment tracking + monthly input planning,
-- mirroring the client's existing "NHAI-Morth" Excel staff register.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubStaffAssignmentStatus" AS ENUM ('ACTIVE', 'LEFT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "SubStaffAssignment" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "projectId" TEXT,
    "staffName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "coOrdinator" TEXT NOT NULL DEFAULT '',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "constructionPeriodMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dlpMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPeriodMonths" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commencementDate" TIMESTAMP(3),
    "lastBilledMonth" TIMESTAMP(3),
    "lastBilledDate" TIMESTAMP(3),
    "mmConstruction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mmDlp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mmEot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remark" TEXT NOT NULL DEFAULT '',
    "status" "SubStaffAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "leftDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubStaffInputPlan" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "plannedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoPlanned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubStaffInputPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubStaffAssignment_projectId_sortOrder_idx" ON "SubStaffAssignment"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "SubStaffAssignment_staffName_idx" ON "SubStaffAssignment"("staffName");

-- CreateIndex
CREATE INDEX "SubStaffAssignment_status_idx" ON "SubStaffAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubStaffInputPlan_assignmentId_year_month_key" ON "SubStaffInputPlan"("assignmentId", "year", "month");

-- CreateIndex
CREATE INDEX "SubStaffInputPlan_year_month_idx" ON "SubStaffInputPlan"("year", "month");

-- AddForeignKey
ALTER TABLE "SubStaffAssignment" ADD CONSTRAINT "SubStaffAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubStaffInputPlan" ADD CONSTRAINT "SubStaffInputPlan_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SubStaffAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
