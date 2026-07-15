-- Infra Admin: role + tables + login user
-- Run this in Neon SQL Editor
-- User table has NO avatar column in this schema.

-- 1) Add INFRA role (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'INFRA'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'INFRA';
  END IF;
END $$;

-- 2) Infra team table
CREATE TABLE IF NOT EXISTS "InfraTeamMember" (
  "id" TEXT PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "InfraTeamMember_manpowerGroup_idx" ON "InfraTeamMember"("manpowerGroup");
CREATE INDEX IF NOT EXISTS "InfraTeamMember_manpowerRole_idx" ON "InfraTeamMember"("manpowerRole");

-- 3) Project assignment (mobilize / demobilize)
CREATE TABLE IF NOT EXISTS "ProjectAssignment" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "teamMemberId" TEXT NOT NULL,
  "mobilizedAt" TIMESTAMP(3),
  "demobilizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectAssignment_teamMemberId_idx" ON "ProjectAssignment"("teamMemberId");

-- 4) Create Infra Admin login
-- email: infra@highwayops.com
-- password: infra@123
INSERT INTO "User" (
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "createdAt",
  "updatedAt"
)
VALUES (
  'infra_admin_001',
  'Infra Admin',
  'infra@highwayops.com',
  '$2b$10$4O6i63YYR/1hvj0LtyuvF.emXNCp8ZtmtHaqq181oWrBu0guqc6iO',
  'INFRA',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;
