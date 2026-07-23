import type { LetterCategory } from "@prisma/client";

export type LetterNumberingInput = {
  projectNumber: string;
  projectCode: string;
  serialLabel: string;
  category: LetterCategory;
  outwardSequence?: string | null;
};

/** Pad whole-number serials (1 → 01); keep insert suffixes (3a → 3a). */
export function formatSerialForLetter(serialLabel: string): string {
  const trimmed = serialLabel.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(2, "0");
  }
  return trimmed;
}

export function formatOutwardSequence(sequence: string): string {
  const trimmed = sequence.trim();
  const match = trimmed.match(/^(\d+)([a-z]*)$/i);
  if (!match) return trimmed;
  return `${match[1].padStart(2, "0")}${match[2].toLowerCase()}`;
}

export function buildLetterNumber(input: LetterNumberingInput): string {
  const serial = formatSerialForLetter(input.serialLabel);
  if (input.category === "INWARD" || input.category === "OTHER") {
    return serial;
  }
  const outward = formatOutwardSequence(input.outwardSequence || "01");
  return `${input.projectNumber.trim()}/${input.projectCode.trim()}/${serial}/${outward}`;
}

/** Next whole serial after existing labels like 1, 2, 3a, 5b → max whole + 1 */
export function nextWholeSerial(labels: string[]): number {
  let max = 0;
  for (const label of labels) {
    const match = label.trim().match(/^(\d+)/);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

/** Next insert suffix under a base serial: 3 → 3a, existing 3a → 3b */
export function nextInsertSerial(baseSerial: number, existingLabels: string[]): string {
  const base = String(baseSerial);
  const suffixes = existingLabels
    .map((label) => label.trim().match(new RegExp(`^${base}([a-z]+)$`, "i")))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[1].toLowerCase());

  if (suffixes.length === 0) return `${base}a`;

  const last = suffixes.sort().at(-1) ?? "a";
  const nextChar = String.fromCharCode(last.charCodeAt(last.length - 1) + 1);
  if (nextChar > "z") {
    return `${base}${last}a`;
  }
  return `${base}${last.slice(0, -1)}${nextChar}`;
}

/** Next outward sequence: 01, 02… ; for insert after 02 → 02a */
export function nextOutwardSequence(existing: string[], afterSequence?: string | null): string {
  if (afterSequence) {
    const match = afterSequence.trim().match(/^(\d+)([a-z]*)$/i);
    if (match) {
      const num = match[1];
      const suffix = match[2].toLowerCase();
      if (!suffix) return formatOutwardSequence(`${Number(num)}${nextLetterSuffix(existing, num)}`);
      return formatOutwardSequence(`${num}${incrementAlpha(suffix)}`);
    }
  }

  let max = 0;
  for (const value of existing) {
    const match = value.trim().match(/^(\d+)/);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return formatOutwardSequence(String(max + 1));
}

/** True when serial is an insert suffix like 3a / 3b (not a whole number). */
export function isInsertSerialLabel(serialLabel: string): boolean {
  return /[a-z]/i.test(serialLabel.trim());
}

/**
 * Plan outward sequences in table (sortOrder) order.
 * Whole rows get 01, 02, 03… Inserted rows (3a/3b) get position-based suffixes (02a after 02).
 */
export function planOutwardSequences(
  letters: Array<{
    id: string;
    category: LetterCategory;
    sortOrder: number;
    serialLabel: string;
  }>
): Map<string, string> {
  const sorted = [...letters].sort((a, b) => a.sortOrder - b.sortOrder);
  const result = new Map<string, string>();
  const assigned: string[] = [];
  let previousSequence: string | null = null;

  for (const letter of sorted) {
    if (letter.category !== "OUTWARD") continue;
    const sequence: string = isInsertSerialLabel(letter.serialLabel)
      ? nextOutwardSequence(assigned, previousSequence)
      : nextOutwardSequence(assigned);
    result.set(letter.id, sequence);
    assigned.push(sequence);
    previousSequence = sequence;
  }

  return result;
}

function nextLetterSuffix(existing: string[], num: string): string {
  const suffixes = existing
    .map((value) => value.trim().match(new RegExp(`^${Number(num)}([a-z]+)$`, "i")))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[1].toLowerCase());
  if (suffixes.length === 0) return "a";
  const last = suffixes.sort().at(-1) ?? "a";
  return incrementAlpha(last);
}

function incrementAlpha(suffix: string): string {
  const last = suffix.charCodeAt(suffix.length - 1);
  if (last < 122) {
    return `${suffix.slice(0, -1)}${String.fromCharCode(last + 1)}`;
  }
  return `${suffix}a`;
}
