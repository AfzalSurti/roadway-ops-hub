-- Referred To column on letter entries
ALTER TABLE "LetterEntry" ADD COLUMN IF NOT EXISTS "referredTo" TEXT NOT NULL DEFAULT '';
