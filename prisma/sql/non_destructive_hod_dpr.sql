-- Add or update Role enum to include HOD (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN','PMO','EMPLOYEE','HOD');
  ELSE
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'Role' AND e.enumlabel = 'HOD') THEN
      ALTER TYPE "Role" ADD VALUE 'HOD';
    END IF;
  END IF;
END$$;

-- Create DprReportStatus enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DprReportStatus') THEN
    CREATE TYPE "DprReportStatus" AS ENUM ('NOT_STARTED','UNDER_PREPARATION','DRAFT_SUBMITTED','UNDER_APPROVAL','APPROVED');
  END IF;
END$$;

-- Create ProjectDprOverview table if not exists
CREATE TABLE IF NOT EXISTS "ProjectDprOverview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" "DprReportStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create unique index on projectId if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'ProjectDprOverview' AND indexname = 'ProjectDprOverview_projectId_key') THEN
    CREATE UNIQUE INDEX "ProjectDprOverview_projectId_key" ON "ProjectDprOverview"("projectId");
  END IF;
END$$;

-- Add foreign key to Project if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
    WHERE tc.table_name = 'ProjectDprOverview' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "ProjectDprOverview" ADD CONSTRAINT "ProjectDprOverview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
