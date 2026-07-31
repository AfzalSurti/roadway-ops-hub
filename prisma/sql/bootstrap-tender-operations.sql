-- Bootstrap: Tender + Operations roles and tables
-- Run after schema migration to ensure tables exist

-- Add new enum values to Role if not already present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TENDER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
    ALTER TYPE "Role" ADD VALUE 'TENDER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OPERATIONS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
    ALTER TYPE "Role" ADD VALUE 'OPERATIONS';
  END IF;
END
$$;

-- TenderBidStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenderBidStatus') THEN
    CREATE TYPE "TenderBidStatus" AS ENUM ('ALLOTTED', 'NOT_ALLOTTED');
  END IF;
END
$$;

-- SecurityDepositType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecurityDepositType') THEN
    CREATE TYPE "SecurityDepositType" AS ENUM ('PERFORMANCE_SECURITY', 'BANK_GUARANTEE', 'FDR', 'SECURITY_BOND');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SECURITY_BOND' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'SecurityDepositType')) THEN
    ALTER TYPE "SecurityDepositType" ADD VALUE 'SECURITY_BOND';
  END IF;
END
$$;

-- TenderBid table
CREATE TABLE IF NOT EXISTS "TenderBid" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "srNo"             INTEGER NOT NULL,
  "nameOfWork"       TEXT NOT NULL,
  "workCategory"     TEXT NOT NULL,
  "client"           TEXT NOT NULL,
  "state"            TEXT NOT NULL DEFAULT '',
  "emd"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tenderFees"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "infraconFees"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"           "TenderBidStatus" NOT NULL DEFAULT 'NOT_ALLOTTED',
  "letterPreviewUrl" TEXT,
  "remarks"          TEXT NOT NULL DEFAULT '',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenderBid_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TenderBid_status_idx" ON "TenderBid"("status");
CREATE INDEX IF NOT EXISTS "TenderBid_workCategory_idx" ON "TenderBid"("workCategory");
CREATE INDEX IF NOT EXISTS "TenderBid_client_idx" ON "TenderBid"("client");

-- Add new TenderBid columns if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='nameOfBidder') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "nameOfBidder" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='bidInvitingAuthority') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "bidInvitingAuthority" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='tenderId') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "tenderId" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='projectLengthKm') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "projectLengthKm" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdType') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdType" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdBank') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdBank" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdIssuedDate') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdIssuedDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdNumber') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdNumber" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdValidUpto') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdValidUpto" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='emdLetterUrl') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "emdLetterUrl" TEXT;
  END IF;
END
$$;

-- PreContractActivity table
CREATE TABLE IF NOT EXISTS "PreContractActivity" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "srNo"                      INTEGER NOT NULL,
  "tenderBidId"               TEXT,
  "nameOfWork"                TEXT NOT NULL,
  "workCategory"              TEXT NOT NULL,
  "client"                    TEXT NOT NULL,
  "state"                     TEXT NOT NULL DEFAULT '',
  "awardOfProjectDate"        TIMESTAMP(3),
  "awardOfProjectLetterUrl"   TEXT,
  "securityDepositType"       "SecurityDepositType",
  "sdBank"                    TEXT NOT NULL DEFAULT '',
  "sdIssuedDate"              TIMESTAMP(3),
  "sdNumber"                  TEXT NOT NULL DEFAULT '',
  "sdAmount"                  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sdExpiryDate"              TIMESTAMP(3),
  "signingAgreementDate"      TIMESTAMP(3),
  "signingAgreementLetterUrl" TEXT,
  "proceedingOrderDate"       TIMESTAMP(3),
  "proceedingOrderLetterUrl"  TEXT,
  "insurancePolicy"           TEXT NOT NULL DEFAULT '',
  "remarks"                   TEXT NOT NULL DEFAULT '',
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreContractActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PreContractActivity_tenderBidId_key" UNIQUE ("tenderBidId"),
  CONSTRAINT "PreContractActivity_tenderBidId_fkey" FOREIGN KEY ("tenderBidId") REFERENCES "TenderBid"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add missing PreContractActivity columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='tenderBidId') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "tenderBidId" TEXT;
    ALTER TABLE "PreContractActivity" ADD CONSTRAINT "PreContractActivity_tenderBidId_key" UNIQUE ("tenderBidId");
    ALTER TABLE "PreContractActivity" ADD CONSTRAINT "PreContractActivity_tenderBidId_fkey" FOREIGN KEY ("tenderBidId") REFERENCES "TenderBid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='sdLetterUrl') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "sdLetterUrl" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdType') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdType" "SecurityDepositType";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdBank') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdBank" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdIssuedDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdIssuedDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdNumber') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdNumber" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdAmount') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdExpiryDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdExpiryDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='additionalSdLetterUrl') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "additionalSdLetterUrl" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyNo') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyNo" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyAmount') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyIssueDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyIssueDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyExpiryDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyExpiryDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='piPlPolicyLetterUrl') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "piPlPolicyLetterUrl" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyNo') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyNo" TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyAmount') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyIssueDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyIssueDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyExpiryDate') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyExpiryDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PreContractActivity' AND column_name='wcPolicyLetterUrl') THEN
    ALTER TABLE "PreContractActivity" ADD COLUMN "wcPolicyLetterUrl" TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "PreContractActivity_tenderBidId_idx" ON "PreContractActivity"("tenderBidId");
CREATE INDEX IF NOT EXISTS "PreContractActivity_workCategory_idx" ON "PreContractActivity"("workCategory");
CREATE INDEX IF NOT EXISTS "PreContractActivity_client_idx" ON "PreContractActivity"("client");

-- Tender user (email: tender@sankalp.com, password: Tender@123)
INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt"
)
VALUES (
  'tender-user',
  'Tender Manager',
  'tender@sankalp.com',
  '$2b$10$DuTAE3HA2fwsObF4LS8G4uCDTyLhfid0k60xDwX7ofCHwFynu0KfO',
  'TENDER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Add bidInvitingAuthorityAddress to TenderBid if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='TenderBid' AND column_name='bidInvitingAuthorityAddress') THEN
    ALTER TABLE "TenderBid" ADD COLUMN "bidInvitingAuthorityAddress" TEXT NOT NULL DEFAULT '';
  END IF;
END
$$;

-- ContractActivity table
CREATE TABLE IF NOT EXISTS "ContractActivity" (
  "id"                          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "srNo"                        INTEGER NOT NULL,
  "tenderBidId"                 TEXT,
  "nameOfWork"                  TEXT NOT NULL,
  "nameOfBidder"                TEXT NOT NULL DEFAULT '',
  "bidInvitingAuthority"        TEXT NOT NULL DEFAULT '',
  "bidInvitingAuthorityAddress" TEXT NOT NULL DEFAULT '',
  "workCategory"                TEXT NOT NULL,
  "client"                      TEXT NOT NULL,
  "state"                       TEXT NOT NULL DEFAULT '',
  "securityDepositType"         "SecurityDepositType",
  "sdBank"                      TEXT NOT NULL DEFAULT '',
  "sdIssuedDate"                TIMESTAMP(3),
  "sdNumber"                    TEXT NOT NULL DEFAULT '',
  "sdAmount"                    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sdExpiryDate"                TIMESTAMP(3),
  "sdLetterUrl"                 TEXT,
  "additionalSdType"            "SecurityDepositType",
  "additionalSdBank"            TEXT NOT NULL DEFAULT '',
  "additionalSdIssuedDate"      TIMESTAMP(3),
  "additionalSdNumber"          TEXT NOT NULL DEFAULT '',
  "additionalSdAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "additionalSdExpiryDate"      TIMESTAMP(3),
  "additionalSdLetterUrl"       TEXT,
  "proceedingOrderDate"         TIMESTAMP(3),
  "proceedingOrderLetterUrl"    TEXT,
  "woAmount"                    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "piPlPolicyNo"                TEXT NOT NULL DEFAULT '',
  "piPlPolicyDate"              TIMESTAMP(3),
  "piPlPolicyAmount"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "piPlPolicyIssueDate"         TIMESTAMP(3),
  "piPlPolicyExpiryDate"        TIMESTAMP(3),
  "piPlPolicyLetterUrl"         TEXT,
  "wcPolicyNo"                  TEXT NOT NULL DEFAULT '',
  "wcPolicyDate"                TIMESTAMP(3),
  "wcPolicyAmount"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  "wcPolicyIssueDate"           TIMESTAMP(3),
  "wcPolicyExpiryDate"          TIMESTAMP(3),
  "wcPolicyLetterUrl"           TEXT,
  "remarks"                     TEXT NOT NULL DEFAULT '',
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractActivity_tenderBidId_key" UNIQUE ("tenderBidId"),
  CONSTRAINT "ContractActivity_tenderBidId_fkey" FOREIGN KEY ("tenderBidId") REFERENCES "TenderBid"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractActivity_tenderBidId_idx" ON "ContractActivity"("tenderBidId");
CREATE INDEX IF NOT EXISTS "ContractActivity_workCategory_idx" ON "ContractActivity"("workCategory");
CREATE INDEX IF NOT EXISTS "ContractActivity_client_idx" ON "ContractActivity"("client");

-- Operations user (email: operations@sankalp.com, password: Operations@123)
INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "createdAt", "updatedAt"
)
VALUES (
  'operations-user',
  'Operations Manager',
  'operations@sankalp.com',
  '$2b$10$.MgrLEpU1h6wPj6bYi.SCOXJdeid1NyLBhpQZww/B8COeqJuDvGZq',
  'OPERATIONS',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;
