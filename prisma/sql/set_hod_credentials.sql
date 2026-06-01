-- HOD account credentials for Neon SQL editor
-- Temporary password used to generate this hash: Hod@123456
-- If you want a different password, replace the hash with a new bcrypt hash.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role'
      AND e.enumlabel = 'HOD'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'HOD';
  END IF;
END$$;

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
  'hod-user',
  'HOD',
  'hod@highwayops.com',
  '$2b$10$ZA.gJOE.aZbYwjIVxufHg.PqnPOCzgZyUMBwgONRDVdZALfwNHNNu',
  'HOD',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "updatedAt" = CURRENT_TIMESTAMP;
