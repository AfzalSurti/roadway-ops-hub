ALTER TABLE "Asset"
ADD COLUMN "projectName" TEXT;

ALTER TABLE "AssetMovement"
ADD COLUMN "previousProjectNumber" TEXT,
ADD COLUMN "previousProjectName" TEXT,
ADD COLUMN "movedToProjectName" TEXT,
ADD COLUMN "assignedDate" TIMESTAMP(3),
ADD COLUMN "returnDate" TIMESTAMP(3);

UPDATE "AssetMovement"
SET "assignedDate" = "dateOfMoving"
WHERE "assignedDate" IS NULL;
