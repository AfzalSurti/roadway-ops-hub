const DEFAULT_SCRAP_RATE = 0.05;

const USEFUL_LIFE_BY_ASSET_CLASS: Record<string, number> = {
  "Bike - Owned": 5,
  "Car - Owned": 8
};

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

export function getUsefulLifeYears(assetClass: string): number {
  return USEFUL_LIFE_BY_ASSET_CLASS[assetClass] ?? 10;
}

export function calculateAssetDepreciation(
  asset: { assetClass: string; purchaseAmount: number; dateOfPurchase?: Date | string | null },
  asOfDate: Date = new Date()
) {
  const usefulLifeYears = getUsefulLifeYears(asset.assetClass);
  const purchaseAmount = Number(asset.purchaseAmount ?? 0);
  const scrapRate = DEFAULT_SCRAP_RATE;
  const scrapValue = roundToTwo(purchaseAmount * scrapRate);
  const depreciationPerYear = usefulLifeYears > 0 ? roundToTwo((purchaseAmount - scrapValue) / usefulLifeYears) : 0;
  const purchaseYear = asset.dateOfPurchase ? new Date(asset.dateOfPurchase).getFullYear() : asOfDate.getFullYear();
  const yearsElapsed = Math.max(asOfDate.getFullYear() - purchaseYear, 0);
  const currentValue = roundToTwo(purchaseAmount - depreciationPerYear * yearsElapsed);

  return {
    usefulLifeYears,
    scrapRate,
    scrapValue,
    depreciationPerYear,
    yearsElapsed,
    currentValue,
    depreciationAsOfYear: asOfDate.getFullYear()
  };
}