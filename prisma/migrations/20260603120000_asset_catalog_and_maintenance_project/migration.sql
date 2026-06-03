CREATE TABLE "AssetClassCatalog" (
    "id" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "types" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetClassCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetClassCatalog_className_key" ON "AssetClassCatalog"("className");

ALTER TABLE "AssetMaintenance"
ADD COLUMN "projectNumber" TEXT,
ADD COLUMN "projectName" TEXT;
