-- Persist uploaded files (PDFs etc.) as BYTEA so Render ephemeral disk does not lose them.
ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "data" BYTEA;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Attachment_fileName_key'
  ) THEN
    ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_fileName_key" UNIQUE ("fileName");
  END IF;
END $$;
