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
    CREATE TYPE "SecurityDepositType" AS ENUM ('PERFORMANCE_SECURITY', 'BANK_GUARANTEE', 'FDR');
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

-- PreContractActivity table
CREATE TABLE IF NOT EXISTS "PreContractActivity" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "srNo"                      INTEGER NOT NULL,
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
  CONSTRAINT "PreContractActivity_pkey" PRIMARY KEY ("id")
);

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
