-- AlterTable
ALTER TABLE "ProjectAssignment" ADD COLUMN IF NOT EXISTS "actualAmount" DOUBLE PRECISION;
ALTER TABLE "ProjectAssignment" ADD COLUMN IF NOT EXISTS "drawnAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfraProjectOtherCost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actualAmount" DOUBLE PRECISION,
    "drawnAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfraProjectOtherCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfraProjectOtherCost_projectId_idx" ON "InfraProjectOtherCost"("projectId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InfraProjectOtherCost" ADD CONSTRAINT "InfraProjectOtherCost_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
