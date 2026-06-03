export function getFinancialYearShort(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 3 ? year % 100 : (year - 1) % 100;
}

export function parseManualFinancialYearShort(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d{2,4}$/.test(trimmed)) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric)) {
    return null;
  }

  if (trimmed.length === 4) {
    if (numeric < 1900 || numeric > 2100) {
      return null;
    }
    return numeric % 100;
  }

  if (numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
}

export function resolveFinancialYearShort(args: {
  financialYearShort?: number;
  manualFinancialYear?: string;
}): number {
  if (args.financialYearShort !== undefined) {
    if (!Number.isInteger(args.financialYearShort) || args.financialYearShort < 0 || args.financialYearShort > 99) {
      throw new Error("Invalid financial year");
    }
    return args.financialYearShort;
  }

  if (args.manualFinancialYear?.trim()) {
    const parsed = parseManualFinancialYearShort(args.manualFinancialYear);
    if (parsed === null) {
      throw new Error("Invalid financial year. Enter 2 digits (e.g. 22) or 4 digits (e.g. 2022).");
    }
    return parsed;
  }

  return getFinancialYearShort();
}
