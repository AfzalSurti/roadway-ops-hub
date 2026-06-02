const DEFAULT_SCRAP_RATE = 0.1;

const USEFUL_LIFE_BY_ASSET_CLASS: Record<string, number> = {
  "Bike - Owned": 5,
  "Car - Owned": 8
};

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function getMonthsElapsed(from: Date, to: Date): number {
  const fromMonth = from.getFullYear() * 12 + from.getMonth();
  const toMonth = to.getFullYear() * 12 + to.getMonth();
  return Math.max(toMonth - fromMonth, 0);
}

export function getUsefulLifeYears(assetType: string): number {
  return USEFUL_LIFE_BY_ASSET_CLASS[assetType] ?? 10;
}

export function calculateAssetDepreciation(
  asset: { assetType: string; purchaseAmount: number; dateOfPurchase?: Date | string | null },
  asOfDate: Date = new Date()
) {
  const usefulLifeYears = getUsefulLifeYears(asset.assetType);
  const purchaseAmount = Number(asset.purchaseAmount ?? 0);
  const scrapRate = DEFAULT_SCRAP_RATE;
  const scrapValue = roundToTwo(purchaseAmount * scrapRate);
  const depreciationPerYear = usefulLifeYears > 0 ? roundToTwo((purchaseAmount - scrapValue) / usefulLifeYears) : 0;
  const depreciationPerMonth = roundToTwo(depreciationPerYear / 12);
  const purchaseDate = asset.dateOfPurchase ? new Date(asset.dateOfPurchase) : asOfDate;
  const monthsElapsed = getMonthsElapsed(purchaseDate, asOfDate);
  const yearsElapsed = Math.floor(monthsElapsed / 12);
  const currentValue = roundToTwo(Math.max(scrapValue, purchaseAmount - depreciationPerMonth * monthsElapsed));

  return {
    usefulLifeYears,
    scrapRate,
    scrapValue,
    depreciationPerYear,
    depreciationPerMonth,
    monthsElapsed,
    yearsElapsed,
    currentValue,
    depreciationAsOfYear: asOfDate.getFullYear()
  };
}