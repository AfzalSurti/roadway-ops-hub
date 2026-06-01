-- Add sale tracking fields to asset maintenance records
ALTER TABLE "AssetMaintenance"
  ADD COLUMN IF NOT EXISTS "soldTo" TEXT,
  ADD COLUMN IF NOT EXISTS "remark" TEXT;
