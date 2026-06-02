ALTER TABLE "Asset"
ADD COLUMN "assignedDate" TIMESTAMP(3);

UPDATE "Asset"
SET "assignedDate" = COALESCE("dateOfPurchase", "createdAt")
WHERE "assignedDate" IS NULL;

ALTER TABLE "AssetMovement"
ADD COLUMN "previousAssignedDate" TIMESTAMP(3),
ADD COLUMN "previousUser" TEXT;
