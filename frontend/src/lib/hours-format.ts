import type { HoursBreakdownItem, HoursRequestStatus, LeaveType } from "./domain";

/** Mirrors backend/src/utils/hours.ts — internal storage is always minutes. */
export const LEAVE_DURATION_MINUTES: Record<LeaveType, number> = {
  FULL_DAY: 480,
  HALF_DAY: 240,
  SHORT_LEAVE: 120
};

export const LEAVE_TYPE_OPTIONS: Array<{ value: LeaveType; label: string; minutes: number }> = [
  { value: "FULL_DAY", label: "Full Day", minutes: 480 },
  { value: "HALF_DAY", label: "Half Day", minutes: 240 },
  { value: "SHORT_LEAVE", label: "Short Leave", minutes: 120 }
];

export function leaveTypeLabel(type: LeaveType): string {
  return LEAVE_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

/** Client's report abbreviation: Full Day -> L, Half Day -> HL, Short Leave -> SL. */
export function leaveTypeShortLabel(type: LeaveType): string {
  if (type === "FULL_DAY") return "L";
  if (type === "HALF_DAY") return "HL";
  return "SL";
}

/** 150 -> "2h 30m" — display-only; never do arithmetic on the label. */
export function minutesToLabel(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes}m`;
  if (minutes === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}

export function statusBadgeVariant(status: HoursRequestStatus): "secondary" | "default" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

export function statusLabel(status: HoursRequestStatus): string {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  return "Pending";
}

/** Local-calendar-day key ("YYYY-MM-DD") — used to match API dates (UTC-noon anchored) against calendar cells. */
export function dateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Local Date -> "YYYY-MM-DD" request payload string (the calendar day the user picked, unambiguous either way). */
export function toRequestDateInput(date: Date): string {
  return dateKey(date);
}

export function formatDisplayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (dateKey(startDate) === dateKey(endDate)) return formatDisplayDate(startDate);
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
}

export function pluralizeDays(numberOfDays: number): string {
  return `${numberOfDays} Day${numberOfDays === 1 ? "" : "s"}`;
}

/** Inclusive day count between two local dates (same day = 1). */
export function daysBetweenInclusive(start: Date, end: Date): number {
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endMidnight.getTime() - startMidnight.getTime()) / 86_400_000) + 1;
}

/** "HH:mm" (24h) -> "6:00 PM". */
export function formatTimeLabel(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

/** Format a full ISO timestamp (as returned by the API) as a 12h time, e.g. "6:00 PM". */
export function formatIsoTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export type HoursBreakdownDisplayRow = {
  key: string;
  leaveDate?: string;
  leaveLabel?: string;
  leaveHours?: string;
  overtimeDate?: string;
  overtimeHours?: string;
  coverage: "Covered" | "Partially Covered" | "Not Covered" | "Extra";
};

/**
 * Deterministic date-wise leave/overtime coverage rows, built from the server's FIFO allocations —
 * shared by the on-screen admin breakdown table and the PDF export so they can never drift apart.
 */
export function buildBreakdownRows(report: HoursBreakdownItem): HoursBreakdownDisplayRow[] {
  const leaveHasAllocation = new Set(report.allocations.map((allocation) => allocation.leaveId));
  const leaveById = new Map(report.leaveBreakdown.map((row) => [row.id, row]));
  const rows: HoursBreakdownDisplayRow[] = [];

  report.allocations.forEach((allocation, index) => {
    const leave = leaveById.get(allocation.leaveId);
    rows.push({
      key: `alloc-${index}`,
      leaveDate: allocation.leaveDate,
      leaveLabel: leaveTypeLabel(allocation.leaveType),
      leaveHours: leave?.durationLabel,
      overtimeDate: allocation.overtimeDate,
      overtimeHours: allocation.minutesAppliedLabel,
      coverage: leave?.coverageStatus === "COVERED" ? "Covered" : "Partially Covered"
    });
  });

  report.leaveBreakdown
    .filter((leave) => !leaveHasAllocation.has(leave.id))
    .forEach((leave) => {
      rows.push({
        key: `leave-${leave.id}`,
        leaveDate: leave.startDate,
        leaveLabel: leaveTypeLabel(leave.leaveType),
        leaveHours: leave.durationLabel,
        coverage: "Not Covered"
      });
    });

  report.overtimeBreakdown
    .filter((overtime) => overtime.extraMinutes > 0)
    .forEach((overtime) => {
      rows.push({
        key: `extra-${overtime.id}`,
        overtimeDate: overtime.date,
        overtimeHours: overtime.extraLabel,
        coverage: "Extra"
      });
    });

  return rows.sort(
    (a, b) =>
      new Date(a.leaveDate ?? a.overtimeDate ?? 0).getTime() - new Date(b.leaveDate ?? b.overtimeDate ?? 0).getTime()
  );
}
