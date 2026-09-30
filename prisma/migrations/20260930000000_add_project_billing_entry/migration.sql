-- Flat per-project RA-bill ledger matching the client's real billing register format.

-- CreateTable
CREATE TABLE "ProjectBillingEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "raBillNo" TEXT NOT NULL DEFAULT '',
    "billNo" TEXT NOT NULL DEFAULT '',
    "month" TEXT NOT NULL DEFAULT '',
    "basicAmountClaimed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basicAmountPassed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sdRetention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountToReceive" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chequeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountHold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBillingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBillingEntry_projectId_sortOrder_idx" ON "ProjectBillingEntry"("projectId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProjectBillingEntry" ADD CONSTRAINT "ProjectBillingEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
