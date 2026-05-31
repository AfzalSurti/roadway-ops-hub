-- Add asset management models and PMO role support

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'IN_STORE', 'UNDER_REPAIR', 'DISPOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "itAssetId" TEXT,
    "assetClass" TEXT NOT NULL,
    "markModel" TEXT,
    "dateOfPurchase" TIMESTAMP(3),
    "warrantyPeriod" TEXT,
    "purchaseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountWithGst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectNumber" TEXT,
    "assignedUser" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_USE',
    "remarks" TEXT,
    "forMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMovement" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "movedToProjectNumber" TEXT,
    "dateOfMoving" TIMESTAMP(3) NOT NULL,
    "movedToUser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "dateOfMaintenance" TIMESTAMP(3) NOT NULL,
    "repairCostInclGst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depreciationTillDate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");

-- CreateIndex
CREATE INDEX "Asset_projectNumber_idx" ON "Asset"("projectNumber");

-- CreateIndex
CREATE INDEX "Asset_assetClass_idx" ON "Asset"("assetClass");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE INDEX "AssetMovement_assetId_idx" ON "AssetMovement"("assetId");

-- CreateIndex
CREATE INDEX "AssetMaintenance_assetId_idx" ON "AssetMaintenance"("assetId");

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
