-- Add separate type field for assets.
ALTER TABLE "Asset"
ADD COLUMN "assetType" TEXT DEFAULT 'Other';

-- Backfill class/type from existing combined class values.
UPDATE "Asset"
SET
  "assetClass" = CASE
    WHEN "assetClass" LIKE 'Appliances - %' OR "assetClass" LIKE 'Appliance - %' OR "assetClass" = 'Applance- Washing machine' THEN 'Appliances'
    WHEN "assetClass" LIKE 'IT - %' THEN 'IT'
    WHEN "assetClass" IN ('Bike - Owned', 'Car - Owned') THEN 'Vehicles'
    WHEN "assetClass" LIKE 'Misc - %' THEN 'Misc'
    WHEN "assetClass" LIKE 'Chair - %'
      OR "assetClass" IN ('Cupboard', 'Almirah', 'Steel Rack', 'Table - Dining (Plastic)', 'Table - Office / Computer', 'SF - Bed', 'SF - Bed sheet', 'SF - Blanket', 'SF - Mattress', 'SF - Pillow & Cover')
      THEN 'Furniture'
    ELSE 'Other'
  END,
  "assetType" = CASE
    WHEN "assetClass" LIKE 'Appliances - %' THEN TRIM(REPLACE("assetClass", 'Appliances - ', ''))
    WHEN "assetClass" LIKE 'Appliance - %' THEN TRIM(REPLACE("assetClass", 'Appliance - ', ''))
    WHEN "assetClass" = 'Applance- Washing machine' THEN 'Washing machine'
    WHEN "assetClass" LIKE 'IT - %' THEN TRIM(REPLACE("assetClass", 'IT - ', ''))
    WHEN "assetClass" LIKE 'Misc - %' THEN TRIM(REPLACE("assetClass", 'Misc - ', ''))
    ELSE "assetClass"
  END;

ALTER TABLE "Asset"
ALTER COLUMN "assetType" SET NOT NULL;

CREATE INDEX "Asset_assetType_idx" ON "Asset"("assetType");
