-- Infra financial cost fields
ALTER TABLE "InfraTeamMember" ADD COLUMN IF NOT EXISTS "monthlyCost" DOUBLE PRECISION;
ALTER TABLE "ProjectAssignment" ADD COLUMN IF NOT EXISTS "daysWorked" DOUBLE PRECISION;
