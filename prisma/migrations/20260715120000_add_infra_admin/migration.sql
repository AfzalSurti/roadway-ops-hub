-- Add INFRA role and Infra Admin tables

-- AlterEnum
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INFRA';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

-- Fallback for older Postgres without IF NOT EXISTS on enum values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role')
     AND NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'Role' AND e.enumlabel = 'INFRA'
     ) THEN
    ALTER TYPE "Role" ADD VALUE 'INFRA';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InfraTeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "manpowerGroup" TEXT NOT NULL,
    "manpowerRole" TEXT NOT NULL,
    "currentProject" TEXT,
    "mobilizedAt" TIMESTAMP(3),
    "demobilizedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfraTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "mobilizedAt" TIMESTAMP(3),
    "demobilizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfraTeamMember_manpowerGroup_idx" ON "InfraTeamMember"("manpowerGroup");
CREATE INDEX IF NOT EXISTS "InfraTeamMember_manpowerRole_idx" ON "InfraTeamMember"("manpowerRole");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_teamMemberId_idx" ON "ProjectAssignment"("teamMemberId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAssignment_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectAssignment"
      ADD CONSTRAINT "ProjectAssignment_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAssignment_teamMemberId_fkey'
  ) THEN
    ALTER TABLE "ProjectAssignment"
      ADD CONSTRAINT "ProjectAssignment_teamMemberId_fkey"
      FOREIGN KEY ("teamMemberId") REFERENCES "InfraTeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
