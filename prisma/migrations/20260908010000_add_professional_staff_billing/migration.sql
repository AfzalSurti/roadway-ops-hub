-- Parallel "professional staff" billing (person-months against rate, like RA-02's staff-cost
-- invoices) alongside the existing percentage-of-item RA bills.

-- CreateTable
CREATE TABLE "ProjectFinancialProfession" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'KEY',
    "position" TEXT NOT NULL,
    "personName" TEXT NOT NULL DEFAULT '',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mmConstruction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mmMaintenance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFinancialProfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFinancialProfessionalBill" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billName" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL DEFAULT '',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFinancialProfessionalBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFinancialProfessionalBillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "currentMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFinancialProfessionalBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFinancialProfession_planId_idx" ON "ProjectFinancialProfession"("planId");

-- CreateIndex
CREATE INDEX "ProjectFinancialProfessionalBill_planId_idx" ON "ProjectFinancialProfessionalBill"("planId");

-- CreateIndex
CREATE INDEX "ProjectFinancialProfessionalBillItem_billId_idx" ON "ProjectFinancialProfessionalBillItem"("billId");

-- CreateIndex
CREATE INDEX "ProjectFinancialProfessionalBillItem_professionId_idx" ON "ProjectFinancialProfessionalBillItem"("professionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFinancialProfessionalBillItem_billId_professionId_key" ON "ProjectFinancialProfessionalBillItem"("billId", "professionId");

-- AddForeignKey
ALTER TABLE "ProjectFinancialProfession" ADD CONSTRAINT "ProjectFinancialProfession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectFinancialPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFinancialProfessionalBill" ADD CONSTRAINT "ProjectFinancialProfessionalBill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectFinancialPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFinancialProfessionalBillItem" ADD CONSTRAINT "ProjectFinancialProfessionalBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "ProjectFinancialProfessionalBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFinancialProfessionalBillItem" ADD CONSTRAINT "ProjectFinancialProfessionalBillItem_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "ProjectFinancialProfession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
