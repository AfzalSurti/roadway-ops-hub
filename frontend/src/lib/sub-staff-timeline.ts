import type { SubStaffAssignment } from "./domain";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export type MonthlyBreakdownEntry = {
  staffName: string;
  designation: string;
  siteName: string;
  plannedDays: number;
};

export type MonthlyBreakdownMonth = {
  key: string;
  label: string;
  totalDays: number;
  entries: MonthlyBreakdownEntry[];
};

/** Flattens every assignment's monthly planned-days rows into one chronological, month-by-month
 * breakdown — used by both the Project and Staff profile popups to show "who worked where, when". */
export function buildMonthlyBreakdown(assignments: SubStaffAssignment[]): MonthlyBreakdownMonth[] {
  const byMonth = new Map<string, MonthlyBreakdownMonth>();

  for (const assignment of assignments) {
    for (const plan of assignment.inputPlans) {
      if (!plan.plannedDays) continue;
      const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`;
      const month = byMonth.get(key) ?? {
        key,
        label: `${MONTH_LABELS[plan.month - 1]} ${plan.year}`,
        totalDays: 0,
        entries: []
      };
      month.totalDays += plan.plannedDays;
      month.entries.push({
        staffName: assignment.staffName,
        designation: assignment.designation,
        siteName: assignment.siteName,
        plannedDays: plan.plannedDays
      });
      byMonth.set(key, month);
    }
  }

  return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
}
