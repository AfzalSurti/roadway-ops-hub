export const DEFAULT_BIDDER_OPTIONS = [
  "Geo Designs & Research Pvt. Ltd.",
  "Sai Geotechnical lab",
] as const;

export const TENDER_OPTION_STORAGE_KEYS = {
  bidders: "roadway.tender.bidderOptions",
  authorities: "roadway.tender.authorityOptions",
  authorityAddresses: "roadway.tender.authorityAddressOptions",
} as const;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadStoredOptions(storageKey: string): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function rememberOption(storageKey: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed || !canUseStorage()) return;
  const existing = loadStoredOptions(storageKey);
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  window.localStorage.setItem(storageKey, JSON.stringify([...existing, trimmed]));
}

export function mergeOptionLists(...lists: Array<Iterable<string | null | undefined>>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
