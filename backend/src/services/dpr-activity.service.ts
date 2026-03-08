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

async function readCsvLines(fileName: string): Promise<string[]> {
  const csvPath = path.resolve(process.cwd(), fileName);
  try {
    const raw = await readFile(csvPath, "utf8");
    return raw.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function pushActivity(args: {
  items: DprActivity[];
  seen: Set<string>;
  label: string;
  description: string;
  reference?: string;
}) {
  const normalized = args.label.replace(/\s+/g, " ").trim();
  if (!shouldKeepActivity(normalized)) {
    return;
  }

  const key = normalized.toLowerCase();
  if (args.seen.has(key)) {
    return;
  }

  args.seen.add(key);
  args.items.push({
    id: `dpr-${args.items.length + 1}`,
    label: normalized,
    description: args.description || normalized,
    reference: args.reference
  });
}

export const dprActivityService = {
  async list(): Promise<DprActivity[]> {
    if (cache) {
      return cache;
    }

    const dprLines = await readCsvLines("E) DPR Activity R1 (Autosaved).csv");
    const reviewLines = await readCsvLines("B) Task reviews.csv");

    const seen = new Set<string>();
    const items: DprActivity[] = [];

    for (const line of dprLines) {
      const cols = parseCsvLine(line);
      if (cols.length < 2) {
        continue;
      }

      const description = cols[1]?.trim() ?? "";
      pushActivity({
        items,
        seen,
        label: description,
        description,
        reference: cols[2]?.trim() || undefined
      });
    }

    // Also include legacy task names from Task Reviews sheet (Task Description column)
    for (const line of reviewLines) {
      const cols = parseCsvLine(line);
      if (cols.length < 5) {
        continue;
      }

      const taskDescription = cols[4]?.trim() ?? "";
      pushActivity({
        items,
        seen,
        label: taskDescription,
        description: taskDescription,
        reference: cols[2]?.trim() || undefined
      });
    }

    cache = items;
    return items;
  }
};
