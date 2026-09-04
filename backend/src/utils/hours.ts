import type { LeaveType } from "@prisma/client";

/** Leave duration constants, in minutes — the single source of truth for leave hour math. */
export const LEAVE_DURATION_MINUTES: Record<LeaveType, number> = {
  FULL_DAY: 480,
  HALF_DAY: 240,
  SHORT_LEAVE: 120
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Shift a real UTC instant into an "IST-as-UTC" virtual instant so UTC getters read IST wall-clock fields. */
function toIstVirtual(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Reverse of toIstVirtual — turn an IST wall-clock instant back into the real UTC instant. */
function fromIstVirtual(date: Date): Date {
  return new Date(date.getTime() - IST_OFFSET_MS);
}

/** Anchor a calendar day (as seen in IST) at UTC noon so no timezone can shift it to the next/previous day. */
export function calendarDayToUtcNoon(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day, 12, 0, 0, 0));
}

/** Parse a "YYYY-MM-DD" (or ISO) date string into its UTC-noon-anchored calendar day. */
export function parseHoursDate(value: string): Date {
  const text = value.trim();
  const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateOnly) {
    return calendarDayToUtcNoon(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3]));
  }
  // Fall back: read the calendar day as it appears in IST wall-clock time.
  const parsed = new Date(text);
  const virtual = toIstVirtual(parsed);
  return calendarDayToUtcNoon(virtual.getUTCFullYear(), virtual.getUTCMonth(), virtual.getUTCDate());
}

/** The 26th-of-month → 25th-of-next-month cycle (in IST) that contains the given instant. */
export function periodBoundsForDate(reference: Date): { startDate: Date; endDate: Date } {
  const virtual = toIstVirtual(reference);
  const day = virtual.getUTCDate();
  const month = virtual.getUTCMonth() - (day <= 25 ? 1 : 0);
  const year = virtual.getUTCFullYear();

  const startVirtual = new Date(Date.UTC(year, month, 26, 0, 0, 0, 0));
  const endVirtual = new Date(
    Date.UTC(startVirtual.getUTCFullYear(), startVirtual.getUTCMonth() + 1, 25, 23, 59, 59, 999)
  );

  return { startDate: fromIstVirtual(startVirtual), endDate: fromIstVirtual(endVirtual) };
}

/** Current instant, for period resolution — isolated so it's easy to reason about / stub in tests. */
export function now(): Date {
  return new Date();
}

/** Inclusive day count between two UTC-noon-anchored calendar days (same day = 1). */
export function daysBetweenInclusive(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}

/** Combine a "YYYY-MM-DD" date and a 24h "HH:mm" time into the real UTC instant, interpreted in IST. */
export function combineDateAndTime(dateValue: string, timeValue: string): Date {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    throw new Error("Invalid date or time");
  }
  const [, year, month, day] = dateMatch;
  const [, hours, minutes] = timeMatch;
  const virtual = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0)
  );
  return fromIstVirtual(virtual);
}

/** "150" -> "2h 30m". Minutes-only internal storage avoids floating point drift; this is display-only. */
export function minutesToLabel(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes}m`;
  if (minutes === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}
