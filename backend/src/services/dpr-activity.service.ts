import { readFile } from "node:fs/promises";
import path from "node:path";

export type DprActivity = {
  id: string;
  label: string;
  description: string;
  reference?: string;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function shouldKeepActivity(value: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 4) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  const blocked = [
    "activity description",
    "detailed project report",
    "status of activity",
    "checklist"
  ];

  if (blocked.some((token) => lowered.includes(token))) {
    return false;
  }

  if (normalized.startsWith("►") || normalized.startsWith("--")) {
    return false;
  }

  return true;
}

let cache: DprActivity[] | null = null;

export const dprActivityService = {
  async list(): Promise<DprActivity[]> {
    if (cache) {
      return cache;
    }

    const csvPath = path.resolve(process.cwd(), "E) DPR Activity R1 (Autosaved).csv");
    const raw = await readFile(csvPath, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);

    const seen = new Set<string>();
    const items: DprActivity[] = [];

    for (const line of lines) {
      const cols = parseCsvLine(line);
      if (cols.length < 2) {
        continue;
      }

      const description = cols[1]?.trim() ?? "";
      if (!shouldKeepActivity(description)) {
        continue;
      }

      const key = description.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const reference = cols[2]?.trim() || undefined;
      items.push({
        id: `dpr-${items.length + 1}`,
        label: description,
        description,
        reference
      });
    }

    cache = items;
    return items;
  }
};
