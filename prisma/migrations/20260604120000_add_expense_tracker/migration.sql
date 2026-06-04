-- CreateEnum
CREATE TYPE "ExpenseSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSheet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT,
    "siteName" TEXT NOT NULL,
    "siteIncharge" TEXT NOT NULL,
    "totalPersons" INTEGER NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "mobileNumber" TEXT,
    "bankAccount" TEXT,
    "sheetNumber" INTEGER,
    "status" "ExpenseSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEntry" (
    "id" TEXT NOT NULL,
    "expenseSheetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "billAvailable" BOOLEAN NOT NULL DEFAULT false,
    "billNumber" TEXT,
    "billAttachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "expenseEntryId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseApproval" (
    "id" TEXT NOT NULL,
    "expenseSheetId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ExpenseSheetStatus" NOT NULL,
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX "ExpenseCategory_sortOrder_idx" ON "ExpenseCategory"("sortOrder");
CREATE INDEX "ExpenseSheet_employeeId_idx" ON "ExpenseSheet"("employeeId");
CREATE INDEX "ExpenseSheet_projectId_idx" ON "ExpenseSheet"("projectId");
CREATE INDEX "ExpenseSheet_status_idx" ON "ExpenseSheet"("status");
CREATE INDEX "ExpenseSheet_expenseDate_idx" ON "ExpenseSheet"("expenseDate");
CREATE INDEX "ExpenseEntry_expenseSheetId_idx" ON "ExpenseEntry"("expenseSheetId");
CREATE INDEX "ExpenseEntry_categoryId_idx" ON "ExpenseEntry"("categoryId");
CREATE INDEX "ExpenseEntry_entryDate_idx" ON "ExpenseEntry"("entryDate");
CREATE INDEX "ExpenseEntry_billAvailable_idx" ON "ExpenseEntry"("billAvailable");
CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");
CREATE UNIQUE INDEX "Voucher_expenseEntryId_key" ON "Voucher"("expenseEntryId");
CREATE INDEX "Voucher_generatedAt_idx" ON "Voucher"("generatedAt");
CREATE INDEX "ExpenseApproval_expenseSheetId_idx" ON "ExpenseApproval"("expenseSheetId");
CREATE INDEX "ExpenseApproval_reviewerId_idx" ON "ExpenseApproval"("reviewerId");

-- AddForeignKey
ALTER TABLE "ExpenseSheet" ADD CONSTRAINT "ExpenseSheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseSheet" ADD CONSTRAINT "ExpenseSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_expenseSheetId_fkey" FOREIGN KEY ("expenseSheetId") REFERENCES "ExpenseSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseEntry" ADD CONSTRAINT "ExpenseEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_expenseEntryId_fkey" FOREIGN KEY ("expenseEntryId") REFERENCES "ExpenseEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_expenseSheetId_fkey" FOREIGN KEY ("expenseSheetId") REFERENCES "ExpenseSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed expense categories
INSERT INTO "ExpenseCategory" ("id", "name", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('exp_cat_adv_office', 'Advance from Office', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_adv_staff', 'Advance Given to Staff', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_printing', 'Printing & Stationery', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_misc', 'Site / Office / GH / Misc. Expense', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_food', 'Food', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_hotel', 'Hotel Rent', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_fuel', 'Fuel / Petrol / Diesel / CNG', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_vehicle', 'Vehicle Repairs & Maintenance', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('exp_cat_travel', 'Travel / Auto / Bus / Train / Air', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
