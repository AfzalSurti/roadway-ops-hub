import type { HoursRequestStatus, LeaveType } from "./domain";

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
