import { subStaffRepository } from "../repositories/sub-staff.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { projectService } from "./project.service.js";
import { notFound } from "../utils/errors.js";
import type { SubStaffAssignmentStatus } from "@prisma/client";

type AssignmentFields = {
  siteName?: string;
  projectId?: string | null;
  /** Optional, to set/correct the linked (or newly-created) project's number — nothing here is required. */
  projectNumber?: string;
  staffName?: string;
  designation?: string;
  coOrdinator?: string;
  rate?: number;
  constructionPeriodMonths?: number;
  dlpMonths?: number;
  totalPeriodMonths?: number;
  startDate?: string | null;
  endDate?: string | null;
  lastBilledMonth?: string | null;
  lastBilledDate?: string | null;
  mmConstruction?: number;
  mmDlp?: number;
  mmEot?: number;
  totalMm?: number;
  usedMm?: number;
  remark?: string;
  status?: SubStaffAssignmentStatus;
};

function round2(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

function parseDateField(value?: string | null) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Adds a (possibly fractional) number of months to a date, anchored at noon UTC like the rest of this field. */
function addMonths(date: Date, months: number): Date {
  const whole = Math.round(months);
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + whole);
  return next;
}

/** startDate + totalPeriodMonths, when both are known — the default before any manual override. */
function defaultEndDate(startDate: Date | null | undefined, totalPeriodMonths: number | undefined) {
  if (!startDate || !totalPeriodMonths) return null;
  return addMonths(startDate, totalPeriodMonths);
}

const NUMERIC_FIELDS = [
  "rate",
  "constructionPeriodMonths",
  "dlpMonths",
  "totalPeriodMonths",
  "mmConstruction",
  "mmDlp",
  "mmEot",
  "totalMm",
  "usedMm"
] as const;

function normalizeNumbers(fields: AssignmentFields) {
  const out: Record<string, number> = {};
  for (const key of NUMERIC_FIELDS) {
    if (fields[key] !== undefined) out[key] = round2(Number(fields[key]) || 0);
  }
  return out;
}

/** Continuous (fractional) months between two dates, using the client's own 30-day-month convention. */
function monthsBetween(start: Date, end: Date): number {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return days / 30;
}

/**
 * Links an assignment to a real Project record — reusing the main Projects service so a brand-new
 * project typed via "Other" shows up everywhere else in the app (Admin's Projects list, Financial,
 * Billing, …), not just here. An explicit projectId always wins; otherwise the typed name is matched
 * case-insensitively against existing projects, or a new one is created. A project number is only
 * ever set, never overwritten, since nothing here is required.
 */
async function resolveProject(
  projectId: string | null | undefined,
  siteName: string | undefined,
  projectNumber: string | undefined
): Promise<{ id: string; name: string } | null> {
  const trimmedNumber = projectNumber?.trim() || undefined;

  if (projectId) {
    const project = await projectRepository.findById(projectId);
    if (!project) return null;
    if (trimmedNumber && !project.projectNumber) {
      const updated = await projectService.update(project.id, { projectNumber: trimmedNumber });
      return { id: updated.id, name: updated.name };
    }
    return { id: project.id, name: project.name };
  }

  const trimmedName = siteName?.trim();
  if (!trimmedName) return null;

  const existing = await projectRepository.findByNameCaseInsensitive(trimmedName);
  if (existing) {
    if (trimmedNumber && !existing.projectNumber) {
      const updated = await projectService.update(existing.id, { projectNumber: trimmedNumber });
      return { id: updated.id, name: updated.name };
    }
    return { id: existing.id, name: existing.name };
  }

  const created = await projectService.create({ name: trimmedName, projectNumber: trimmedNumber });
  return { id: created.id, name: created.name };
}

// A seed of the client's known designations, merged with whatever's actually in use — so the
// dropdown always covers the common ones even before any data exists, and grows as new ones are typed.
const DESIGNATION_SEED = [
  "CAD Expert",
  "Horticulture Expert",
  "Highway Design Engineer",
  "Bridge Design Engineer",
  "Environment Engineer",
  "Toll Expert",
  "Electrical Engineer",
  "Road and Safety Expert",
  "HTMS/Toll Expert",
  "Accountant",
  "Accountant Cum Cashier",
  "Office Manager",
  "QS",
  "AHE"
];

export type AssignmentMetrics = {
  balanceMm: number;
  elapsedMonths: number;
  totalRemainingMonths: number;
  /** Uncapped — a value above 30 is itself a signal this assignment is behind schedule. */
  suggestedDaysPerMonth: number;
};

/** All figures the client's own sheet computes from the raw fields, derived live instead of stored. */
export function computeMetrics(
  assignment: {
    startDate: Date | null;
    endDate: Date | null;
    totalPeriodMonths: number;
    totalMm: number;
    usedMm: number;
  },
  asOf: Date = new Date()
): AssignmentMetrics {
  const balanceMm = round2(assignment.totalMm - assignment.usedMm);
  const elapsedMonths = assignment.startDate ? monthsBetween(assignment.startDate, asOf) : 0;
  const effectiveEndDate = assignment.endDate ?? defaultEndDate(assignment.startDate, assignment.totalPeriodMonths);
  const totalRemainingMonths = effectiveEndDate ? Math.max(0, round2(monthsBetween(asOf, effectiveEndDate))) : 0;
  const suggestedDaysPerMonth =
    totalRemainingMonths > 0 && balanceMm > 0
      ? round2((balanceMm / totalRemainingMonths) * 30)
      : balanceMm > 0
        ? 30
        : 0;
  return { balanceMm, elapsedMonths: round2(elapsedMonths), totalRemainingMonths, suggestedDaysPerMonth };
}

/** Flattens the linked project's number onto the assignment — it's a display/edit convenience, not a
 * column on this table, so every response that returns an assignment goes through this. */
function serializeAssignment<T extends { project?: { projectNumber: string | null } | null }>(row: T) {
  const { project, ...rest } = row;
  return { ...rest, projectNumber: project?.projectNumber ?? null };
}

export const subStaffService = {
  async list(filters: { status?: SubStaffAssignmentStatus; staffName?: string; siteName?: string }) {
    const rows = await subStaffRepository.list(filters);
    return rows.map(serializeAssignment);
  },

  async getOptions() {
    const [designations, staffNames] = await Promise.all([
      subStaffRepository.distinctDesignations(),
      subStaffRepository.distinctStaffNames()
    ]);
    const merged = new Set([...DESIGNATION_SEED, ...designations]);
    return {
      designations: Array.from(merged).sort((a, b) => a.localeCompare(b)),
      staffNames: staffNames.sort((a, b) => a.localeCompare(b))
    };
  },

  async create(payload: AssignmentFields) {
    if (!payload.staffName?.trim()) throw notFound("Staff name is required");
    const sortOrder = await subStaffRepository.nextSortOrder();
    const startDate = parseDateField(payload.startDate) ?? null;
    const endDate =
      parseDateField(payload.endDate) ?? defaultEndDate(startDate, Number(payload.totalPeriodMonths) || 0);
    const project = await resolveProject(payload.projectId, payload.siteName, payload.projectNumber);
    const created = await subStaffRepository.create({
      siteName: project?.name ?? payload.siteName?.trim() ?? "",
      projectId: project?.id ?? null,
      staffName: payload.staffName.trim(),
      designation: payload.designation?.trim() || "",
      coOrdinator: payload.coOrdinator?.trim() || "",
      startDate,
      endDate,
      lastBilledMonth: parseDateField(payload.lastBilledMonth) ?? null,
      lastBilledDate: parseDateField(payload.lastBilledDate) ?? null,
      remark: payload.remark?.trim() || "",
      status: payload.status ?? "ACTIVE",
      sortOrder,
      ...normalizeNumbers(payload)
    });
    return serializeAssignment(created);
  },

  async bulkImport(rows: AssignmentFields[]) {
    const created: Array<{ row: number; id: string }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (let index = 0; index < rows.length; index += 1) {
      try {
        const entry = await this.create(rows[index]);
        created.push({ row: index + 1, id: entry.id });
      } catch (error) {
        errors.push({ row: index + 1, message: error instanceof Error ? error.message : "Failed to import row" });
      }
    }
    return { createdCount: created.length, failedCount: errors.length, created, errors };
  },

  async update(id: string, payload: AssignmentFields) {
    const existing = await subStaffRepository.findById(id);
    if (!existing) throw notFound("Assignment not found");

    const startDate = payload.startDate === undefined ? undefined : parseDateField(payload.startDate);
    let endDate = payload.endDate === undefined ? undefined : parseDateField(payload.endDate);
    if (endDate === null && payload.startDate !== undefined) {
      // End date cleared while start/period are being (re)set — fall back to the computed default.
      endDate =
        defaultEndDate(
          startDate ?? existing.startDate,
          payload.totalPeriodMonths ?? existing.totalPeriodMonths
        ) ?? null;
    }

    const touchesProject =
      payload.projectId !== undefined || payload.siteName !== undefined || payload.projectNumber !== undefined;
    const project = touchesProject
      ? await resolveProject(payload.projectId, payload.siteName ?? existing.siteName, payload.projectNumber)
      : undefined;

    const updated = await subStaffRepository.update(id, {
      siteName: project !== undefined ? (project?.name ?? payload.siteName?.trim() ?? "") : undefined,
      projectId: project !== undefined ? (project?.id ?? null) : undefined,
      staffName: payload.staffName?.trim(),
      designation: payload.designation?.trim(),
      coOrdinator: payload.coOrdinator?.trim(),
      startDate,
      endDate,
      lastBilledMonth: parseDateField(payload.lastBilledMonth),
      lastBilledDate: parseDateField(payload.lastBilledDate),
      remark: payload.remark?.trim(),
      status: payload.status,
      ...normalizeNumbers(payload)
    });
    return serializeAssignment(updated);
  },

  async remove(id: string) {
    const existing = await subStaffRepository.findById(id);
    if (!existing) throw notFound("Assignment not found");
    await subStaffRepository.delete(id);
  },

  /** Mirrors the client's manual "Multiple Designation" sheet: active staff on 2+ designation/site rows. */
  async getClashReport() {
    const assignments = await subStaffRepository.list({ status: "ACTIVE" });
    const byName = new Map<string, typeof assignments>();
    for (const row of assignments) {
      const key = row.staffName.trim().toLowerCase();
      if (!key) continue;
      const list = byName.get(key) ?? [];
      list.push(row);
      byName.set(key, list);
    }
    const clashes = [...byName.values()]
      .filter((list) => list.length > 1)
      .map((list) => ({
        staffName: list[0].staffName,
        assignments: list.map((row) => ({
          id: row.id,
          siteName: row.siteName,
          designation: row.designation,
          rate: row.rate
        }))
      }))
      .sort((a, b) => a.staffName.localeCompare(b.staffName));
    return { clashCount: clashes.length, clashes };
  },

  /**
   * Auto-generates (or refreshes) this month's planned days for every active assignment, grouped by
   * staff member so one person's days across all their sites never exceed a 30-day month. Assignments
   * closer to their own end date, then higher-rate ones, get their full suggested days first; whatever's
   * left of the 30-day budget goes to the rest, and anything manually edited already is left untouched.
   */
  async generatePlan(year: number, month: number) {
    const asOf = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const assignments = await subStaffRepository.list({ status: "ACTIVE" });

    const byName = new Map<string, typeof assignments>();
    for (const row of assignments) {
      const key = row.staffName.trim().toLowerCase() || row.id;
      const list = byName.get(key) ?? [];
      list.push(row);
      byName.set(key, list);
    }

    const results: Array<{ assignmentId: string; plannedDays: number }> = [];

    for (const group of byName.values()) {
      const weighted = group
        .map((row) => ({ row, metrics: computeMetrics(row, asOf) }))
        .filter((g) => g.metrics.totalRemainingMonths > 0 && g.metrics.balanceMm > 0)
        .sort((a, b) => {
          if (a.metrics.totalRemainingMonths !== b.metrics.totalRemainingMonths) {
            return a.metrics.totalRemainingMonths - b.metrics.totalRemainingMonths;
          }
          return b.row.rate - a.row.rate;
        });

      let budget = 30;
      for (const { row, metrics } of weighted) {
        const existing = row.inputPlans.find((p) => p.year === year && p.month === month);
        if (existing && !existing.autoPlanned) continue; // manual override — leave it alone

        const ideal = Math.min(metrics.suggestedDaysPerMonth, 30);
        const allocated = round2(Math.max(0, Math.min(ideal, budget)));
        budget = round2(Math.max(0, budget - allocated));
        results.push({ assignmentId: row.id, plannedDays: allocated });
      }

      // Anything in the group not in `weighted` (finished or no balance) gets zeroed, unless hand-edited.
      for (const row of group) {
        if (weighted.some((w) => w.row.id === row.id)) continue;
        const existing = row.inputPlans.find((p) => p.year === year && p.month === month);
        if (existing && !existing.autoPlanned) continue;
        results.push({ assignmentId: row.id, plannedDays: 0 });
      }
    }

    await Promise.all(results.map((r) => subStaffRepository.upsertPlan(r.assignmentId, year, month, r.plannedDays, true)));
    return this.getPlanGrid(year, month);
  },

  async setPlanDay(assignmentId: string, year: number, month: number, plannedDays: number) {
    const assignment = await subStaffRepository.findById(assignmentId);
    if (!assignment) throw notFound("Assignment not found");
    await subStaffRepository.upsertPlan(assignmentId, year, month, round2(plannedDays), false);
    return this.getPlanGrid(year, month);
  },

  /** Planning view: every active assignment with its (possibly not-yet-generated) plan for the month. */
  async getPlanGrid(year: number, month: number) {
    const asOf = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const assignments = await subStaffRepository.list({ status: "ACTIVE" });
    return assignments.map((row) => {
      const plan = row.inputPlans.find((p) => p.year === year && p.month === month);
      return {
        assignment: serializeAssignment(row),
        metrics: computeMetrics(row, asOf),
        plannedDays: plan?.plannedDays ?? 0,
        autoPlanned: plan?.autoPlanned ?? true
      };
    });
  }
};
