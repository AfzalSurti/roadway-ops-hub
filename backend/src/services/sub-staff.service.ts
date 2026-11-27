import { subStaffRepository } from "../repositories/sub-staff.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { projectService } from "./project.service.js";
import { notFound, badRequest } from "../utils/errors.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import type { SubStaffAssignmentStatus, SubStaffClientCategory, SubStaffEotAppliesTo } from "@prisma/client";

type AssignmentFields = {
  siteName?: string;
  projectId?: string | null;
  /** Optional, to set/correct the linked (or newly-created) project's number — nothing here is required. */
  projectNumber?: string;
  clientCategory?: SubStaffClientCategory;
  staffName?: string;
  designation?: string;
  coOrdinator?: string;
  rate?: number;
  constructionPeriodMonths?: number;
  dlpMonths?: number;
  eotMonths?: number;
  eotAppliesTo?: SubStaffEotAppliesTo;
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
  "eotMonths",
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

/** Continuous (fractional) months between two dates — the client's own "TOTAL BILLING DONE" convention
 * from their NHAI-Morth register: (end − start) in days, divided by 365, times 12. */
function monthsBetween(start: Date, end: Date): number {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return (days / 365) * 12;
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

// These back-office roles are legitimately full-time on every project they're assigned to for as long
// as it runs — being listed on several projects at once is normal for them, not a scheduling clash, and
// their days aren't split/capped across projects the way a technical expert's are.
const FULL_TIME_DESIGNATIONS = new Set(["office manager", "accountant", "accountant cum cashier"]);

function isFullTimeDesignation(designation: string): boolean {
  return FULL_TIME_DESIGNATIONS.has(designation.trim().toLowerCase());
}

export type AssignmentMetrics = {
  balanceMm: number;
  /** Months of billing actually recorded so far — from Start Date to Last Billed Date (never "today"
   * or End Date), the client's own "TOTAL BILLING DONE" figure. */
  billedMonthsTotal: number;
  /** Sum of the two phases below — used for cross-project priority (whichever project finishes soonest). */
  totalRemainingMonths: number;
  /** Sum of the two phases below — the figure the monthly planner actually allocates against. */
  suggestedDaysPerMonth: number;
  remainingConsMonths: number;
  /** DLP + EOT combined — EOT doesn't get its own column, but its time must still count somewhere. */
  remainingDlpMonths: number;
  staffBalanceMmConstruction: number;
  staffBalanceMmDlp: number;
  suggestedDaysConstruction: number;
  suggestedDaysDlp: number;
  /** MM contracted for this person, for this phase, beyond what the project's own remaining calendar
   * time could ever absorb (at the natural 1 MM = 1 month cap) — i.e. MM that can never actually be
   * billed before the project's time runs out. 0 when the phase still has enough time left. */
  lossMmConstruction: number;
  lossMmDlp: number;
  /** The above, priced at this assignment's own rate — a concrete rupee figure for "unusable" MM. */
  lossAmountConstruction: number;
  lossAmountDlp: number;
};

/**
 * Verified against the client's real "NHAI-Morth" register (its "Project Billed/Remaining CONS./DLP"
 * and "Staff MM Remaining Construction/DLP" columns), reverse-engineered from live formulas and real
 * rows:
 *
 * - The PROJECT's phase (how much of the Construction/DLP calendar window is used up) is driven by
 *   billed TIME, not MM: months from Start Date to Last Billed Date, compared against the Construction
 *   Period, with any excess counted into the DLP window. This never uses "today" or the End Date — a
 *   project's phase only moves when a bill is actually recorded against it.
 * - The STAFF's balance is driven by MM, not time: Used MM is drawn down against the Construction MM
 *   contract first; only MM used beyond that contract counts against the DLP (+ EOT) MM contract. A
 *   phase's balance can go negative (over budget) — that's a real signal in their sheet, not an error,
 *   so it's never floored to 0 here.
 */
export function computeMetrics(
  assignment: {
    startDate: Date | null;
    endDate: Date | null;
    lastBilledDate: Date | null;
    constructionPeriodMonths: number;
    dlpMonths: number;
    eotMonths: number;
    eotAppliesTo: "CONSTRUCTION" | "DLP";
    totalPeriodMonths: number;
    mmConstruction: number;
    mmDlp: number;
    mmEot: number;
    totalMm: number;
    usedMm: number;
    rate: number;
  },
  asOf: Date = new Date()
): AssignmentMetrics {
  const balanceMm = round2(assignment.totalMm - assignment.usedMm);

  const billedMonthsTotal =
    assignment.startDate && assignment.lastBilledDate
      ? Math.max(0, monthsBetween(assignment.startDate, assignment.lastBilledDate))
      : 0;

  // Extension of Time extends whichever window the contract says — Construction or DLP — instead of
  // always folding into DLP.
  const eotOnConstruction = assignment.eotAppliesTo === "CONSTRUCTION";
  const constructionPeriodMonths = (assignment.constructionPeriodMonths || 0) + (eotOnConstruction ? assignment.eotMonths || 0 : 0);
  const dlpWindowMonths = (assignment.dlpMonths || 0) + (eotOnConstruction ? 0 : assignment.eotMonths || 0);

  const billedConsMonths = Math.min(billedMonthsTotal, constructionPeriodMonths);
  const billedDlpMonths = Math.max(0, billedMonthsTotal - constructionPeriodMonths);
  const remainingConsMonths = round2(constructionPeriodMonths - billedConsMonths);
  const remainingDlpMonths = round2(dlpWindowMonths - billedDlpMonths);

  const mmConstructionTotal = (assignment.mmConstruction || 0) + (eotOnConstruction ? assignment.mmEot || 0 : 0);
  const mmDlpTotal = (assignment.mmDlp || 0) + (eotOnConstruction ? 0 : assignment.mmEot || 0);
  const usedMmDlp = Math.max(0, assignment.usedMm - mmConstructionTotal);
  const rawStaffBalanceMmConstruction = round2(mmConstructionTotal - assignment.usedMm);
  const staffBalanceMmDlp = round2(mmDlpTotal - usedMmDlp);
  // Once Construction's own calendar time is used up, its MM balance is no longer "live" — whatever's
  // left (or overspent) there is already folded into the DLP side above, so showing a lingering
  // negative number here would just be confusing noise.
  const staffBalanceMmConstruction = remainingConsMonths > 0 ? rawStaffBalanceMmConstruction : 0;

  // A single project can never need more than a 30-day month of attendance — cap the displayed
  // suggestion at that physical ceiling rather than showing an implausible "110 days/month".
  const suggestedDaysConstruction =
    remainingConsMonths > 0
      ? Math.max(0, Math.min(30, round2((staffBalanceMmConstruction / remainingConsMonths) * 30)))
      : 0;
  const suggestedDaysDlp =
    remainingDlpMonths > 0 ? Math.max(0, Math.min(30, round2((staffBalanceMmDlp / remainingDlpMonths) * 30))) : 0;

  // If the staff's own contracted MM for a phase is more than the phase's remaining calendar time could
  // ever absorb (at the natural 1 MM = 1 month cap), that excess can never actually be billed before the
  // project's time runs out — flagged here as a concrete, priced "loss" rather than just an oversized
  // suggested-days number.
  const lossMmConstruction =
    remainingConsMonths > 0 ? round2(Math.max(0, rawStaffBalanceMmConstruction - remainingConsMonths)) : 0;
  const lossMmDlp = remainingDlpMonths > 0 ? round2(Math.max(0, staffBalanceMmDlp - remainingDlpMonths)) : 0;
  const lossAmountConstruction = round2(lossMmConstruction * (assignment.rate || 0));
  const lossAmountDlp = round2(lossMmDlp * (assignment.rate || 0));

  const totalRemainingMonths = round2(remainingConsMonths + remainingDlpMonths);
  let suggestedDaysPerMonth = round2(suggestedDaysConstruction + suggestedDaysDlp);
  // Neither phase has any contracted time left (e.g. period fields were never filled in on an older
  // record) but there's still an unclaimed balance — fall back to the old whole-period estimate so the
  // balance isn't silently stranded at 0 days/month forever.
  if (totalRemainingMonths <= 0 && balanceMm > 0) {
    const effectiveEndDate = assignment.endDate ?? defaultEndDate(assignment.startDate, assignment.totalPeriodMonths);
    const fallbackRemaining = effectiveEndDate ? Math.max(0, monthsBetween(asOf, effectiveEndDate)) : 0;
    suggestedDaysPerMonth = fallbackRemaining > 0 ? round2((balanceMm / fallbackRemaining) * 30) : 30;
  }

  return {
    balanceMm,
    billedMonthsTotal: round2(billedMonthsTotal),
    totalRemainingMonths,
    suggestedDaysPerMonth,
    remainingConsMonths,
    remainingDlpMonths,
    staffBalanceMmConstruction,
    staffBalanceMmDlp,
    suggestedDaysConstruction,
    suggestedDaysDlp,
    lossMmConstruction,
    lossMmDlp,
    lossAmountConstruction,
    lossAmountDlp
  };
}

/** Flattens the linked project's number onto the assignment — it's a display/edit convenience, not a
 * column on this table, so every response that returns an assignment goes through this. */
function serializeAssignment<T extends { project?: { projectNumber: string | null } | null }>(row: T) {
  const { project, ...rest } = row;
  return { ...rest, projectNumber: project?.projectNumber ?? null };
}

/** An explicit choice always wins; otherwise guessed from the site name, since the register's own
 * naming already distinguishes MORTH/NHAI sites — anything else defaults to OTHER until corrected. */
function resolveClientCategory(explicit: SubStaffClientCategory | undefined, siteName: string): SubStaffClientCategory {
  if (explicit) return explicit;
  const name = siteName.toLowerCase();
  if (name.includes("morth")) return "MORTH";
  if (name.includes("nhai")) return "NHAI";
  return "OTHER";
}

export const subStaffService = {
  async list(filters: {
    status?: SubStaffAssignmentStatus;
    staffName?: string;
    siteName?: string;
    designation?: string;
    clientCategory?: SubStaffClientCategory;
  }) {
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
    const resolvedSiteName = project?.name ?? payload.siteName?.trim() ?? "";
    const created = await subStaffRepository.create({
      siteName: resolvedSiteName,
      projectId: project?.id ?? null,
      clientCategory: resolveClientCategory(payload.clientCategory, resolvedSiteName),
      staffName: payload.staffName.trim(),
      designation: payload.designation?.trim() || "",
      coOrdinator: payload.coOrdinator?.trim() || "",
      startDate,
      endDate,
      lastBilledMonth: parseDateField(payload.lastBilledMonth) ?? null,
      lastBilledDate: parseDateField(payload.lastBilledDate) ?? null,
      remark: payload.remark?.trim() || "",
      status: payload.status ?? "ACTIVE",
      eotAppliesTo: payload.eotAppliesTo ?? "DLP",
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
      clientCategory: payload.clientCategory,
      staffName: payload.staffName?.trim(),
      designation: payload.designation?.trim(),
      coOrdinator: payload.coOrdinator?.trim(),
      eotAppliesTo: payload.eotAppliesTo,
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
      if (isFullTimeDesignation(row.designation)) continue; // full-time on every project — not a clash
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
   * AI-assisted resolution for one staff member's clash: hands the model each clashing assignment's
   * real numbers (rate, remaining Construction/DLP months, balance MM, computed Suggested Days) for a
   * specific month, and asks for a plain-language rationale plus a concrete day split — prioritizing
   * whichever project ends soonest and is worth more, the same factors the plain formula uses, but with
   * room for judgment calls the formula can't make. Called on demand only (never automatically) since
   * each call spends real OpenRouter tokens.
   */
  async getClashSolution(staffName: string, year: number, month: number) {
    if (!env.OPENROUTER_API_KEY) {
      throw badRequest("AI clash resolution isn't configured — set OPENROUTER_API_KEY on the server.");
    }

    const asOf = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const normalized = staffName.trim().toLowerCase();
    const assignments = (await subStaffRepository.list({ status: "ACTIVE" })).filter(
      (row) => row.staffName.trim().toLowerCase() === normalized && !isFullTimeDesignation(row.designation)
    );
    if (assignments.length < 2) {
      throw badRequest("No clash to resolve for this person — they're on fewer than 2 competing assignments.");
    }

    const entries = assignments.map((row) => ({ row, metrics: computeMetrics(row, asOf) }));

    const projectLines = entries
      .map(
        ({ row, metrics }, i) =>
          `${i + 1}. assignmentId=${row.id} | Project: ${row.siteName} | Designation: ${row.designation} | ` +
          `Rate: ${row.rate}/month | Remaining Construction Months: ${metrics.remainingConsMonths.toFixed(2)} | ` +
          `Remaining DLP Months: ${metrics.remainingDlpMonths.toFixed(2)} | Staff Balance MM (Construction): ${metrics.staffBalanceMmConstruction.toFixed(2)} | ` +
          `Staff Balance MM (DLP): ${metrics.staffBalanceMmDlp.toFixed(2)} | Suggested Days (Construction): ${metrics.suggestedDaysConstruction.toFixed(1)} | ` +
          `Suggested Days (DLP): ${metrics.suggestedDaysDlp.toFixed(1)}`
      )
      .join("\n");

    const systemPrompt = [
      "You help an accounts team split one staff member's working days across multiple projects they're",
      "assigned to at the same time, for one specific calendar month. The person can give at most 30",
      "days total across ALL listed assignments combined (construction + DLP days summed over every",
      "assignment) — never more.",
      "Prioritize projects that are ending sooner (lower Remaining Months) and projects worth more",
      "(higher Rate), the same way a human planner would, but use judgment rather than a rigid formula —",
      "e.g. don't starve a lower-priority project down to 0 days every single month if it still has a",
      "meaningful balance and some time left.",
      "Respond with JSON only, no prose outside the JSON, in exactly this shape:",
      '{"explanation": "short plain-language paragraph explaining the recommended split and why",',
      ' "allocations": [{"assignmentId": "...", "constructionDays": number, "dlpDays": number}, ...]}',
      "Include one allocation entry per assignmentId given below. Use 0 for a phase that isn't relevant",
      "to that assignment (e.g. dlpDays=0 if Remaining DLP Months is 0)."
    ].join("\n");

    const userPrompt = `Staff member: ${staffName}\nMonth: ${month}/${year}\n\nAssignments:\n${projectLines}`;

    let content: string | undefined;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, "OpenRouter clash-solution request failed");
        throw badRequest("The AI service didn't respond — please try again.");
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      content = payload.choices?.[0]?.message?.content;
    } catch (error) {
      if (error instanceof Error && "statusCode" in error) throw error;
      logger.warn({ err: error }, "OpenRouter clash-solution unavailable");
      throw badRequest("Could not reach the AI service — please try again.");
    }

    if (!content) throw badRequest("The AI service returned an empty response — please try again.");

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    let parsed: { explanation?: string; allocations?: Array<{ assignmentId?: string; constructionDays?: number; dlpDays?: number }> } | null = null;
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(content.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
    if (!parsed) throw badRequest("Could not understand the AI's response — please try again.");

    const knownIds = new Set(entries.map((e) => e.row.id));
    const byId = new Map((parsed.allocations ?? []).map((a) => [a.assignmentId, a]));
    const allocations = entries.map(({ row, metrics }) => {
      const suggestion = byId.get(row.id);
      const clamp = (value: number | undefined, fallback: number) =>
        Number.isFinite(value) ? Math.min(31, Math.max(0, round2(value as number))) : fallback;
      return {
        assignmentId: row.id,
        siteName: row.siteName,
        designation: row.designation,
        constructionDays: clamp(suggestion?.constructionDays, metrics.suggestedDaysConstruction),
        dlpDays: clamp(suggestion?.dlpDays, metrics.suggestedDaysDlp)
      };
    });
    // Drop anything the AI invented that isn't actually one of this person's assignments.
    const filteredAllocations = allocations.filter((a) => knownIds.has(a.assignmentId));

    return {
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      allocations: filteredAllocations
    };
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

    const results: Array<{ assignmentId: string; plannedDaysConstruction: number; plannedDaysDlp: number }> = [];

    const splitByShare = (allocated: number, metrics: AssignmentMetrics) => {
      // Split the allocated days between Construction/DLP in the same ratio as their suggested need.
      // In practice only one phase is ever active for a given assignment, so this puts 100% of the
      // days there — the split only matters for a mid-month Construction-to-DLP transition.
      const suggestedTotal = metrics.suggestedDaysConstruction + metrics.suggestedDaysDlp;
      const consShare = suggestedTotal > 0 ? metrics.suggestedDaysConstruction / suggestedTotal : 0;
      const plannedDaysConstruction = round2(allocated * consShare);
      const plannedDaysDlp = round2(allocated - plannedDaysConstruction);
      return { plannedDaysConstruction, plannedDaysDlp };
    };

    for (const group of byName.values()) {
      // Full-time back-office roles (Office Manager, Accountant, ...) are on every project they're
      // assigned to for its whole duration — each gets its own full days independently, never sharing
      // or competing for the 30-day budget the way technical experts do.
      for (const row of group.filter((r) => isFullTimeDesignation(r.designation))) {
        const existing = row.inputPlans.find((p) => p.year === year && p.month === month);
        if (existing && !existing.autoPlanned) continue; // manual override — leave it alone
        const metrics = computeMetrics(row, asOf);
        const allocated =
          metrics.totalRemainingMonths > 0 ? round2(Math.min(metrics.suggestedDaysPerMonth, 30)) : 0;
        results.push({ assignmentId: row.id, ...splitByShare(allocated, metrics) });
      }

      const sharedGroup = group.filter((r) => !isFullTimeDesignation(r.designation));
      const weighted = sharedGroup
        .map((row) => ({ row, metrics: computeMetrics(row, asOf) }))
        .filter((g) => g.metrics.totalRemainingMonths > 0 && g.metrics.suggestedDaysPerMonth > 0)
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
        results.push({ assignmentId: row.id, ...splitByShare(allocated, metrics) });
      }

      // Anything in the shared group not in `weighted` (finished or no balance) gets zeroed, unless
      // hand-edited.
      for (const row of sharedGroup) {
        if (weighted.some((w) => w.row.id === row.id)) continue;
        const existing = row.inputPlans.find((p) => p.year === year && p.month === month);
        if (existing && !existing.autoPlanned) continue;
        results.push({ assignmentId: row.id, plannedDaysConstruction: 0, plannedDaysDlp: 0 });
      }
    }

    await Promise.all(
      results.map((r) =>
        subStaffRepository.upsertPlan(
          r.assignmentId,
          year,
          month,
          { plannedDaysConstruction: r.plannedDaysConstruction, plannedDaysDlp: r.plannedDaysDlp },
          true
        )
      )
    );
    return this.getPlanGrid(year, month);
  },

  async setPlanDay(assignmentId: string, year: number, month: number, field: "construction" | "dlp", value: number) {
    const assignment = await subStaffRepository.findById(assignmentId);
    if (!assignment) throw notFound("Assignment not found");
    const existing = assignment.inputPlans.find((p) => p.year === year && p.month === month);
    const plannedDaysConstruction = field === "construction" ? round2(value) : existing?.plannedDaysConstruction ?? 0;
    const plannedDaysDlp = field === "dlp" ? round2(value) : existing?.plannedDaysDlp ?? 0;
    await subStaffRepository.upsertPlan(assignmentId, year, month, { plannedDaysConstruction, plannedDaysDlp }, false);
    return this.getPlanGrid(year, month);
  },

  /** Locks (or unlocks) a month's plan for one assignment, independent of its day values — a "Confirmed"
   * checkbox the user ticks once they're happy with the numbers, so a later Generate/Refresh never
   * silently rewrites it. Internally this is the same autoPlanned flag Generate Plan already respects. */
  async confirmPlanDay(assignmentId: string, year: number, month: number, confirmed: boolean) {
    const assignment = await subStaffRepository.findById(assignmentId);
    if (!assignment) throw notFound("Assignment not found");
    const existing = assignment.inputPlans.find((p) => p.year === year && p.month === month);
    await subStaffRepository.upsertPlan(
      assignmentId,
      year,
      month,
      {
        plannedDaysConstruction: existing?.plannedDaysConstruction ?? 0,
        plannedDaysDlp: existing?.plannedDaysDlp ?? 0
      },
      !confirmed
    );
    return this.getPlanGrid(year, month);
  },

  /** Data-cleanup helper: repoints every assignment on a duplicate Project record onto the real one and
   * deletes the now-empty duplicate — for cases like Billing's "Nandyal" vs the staff register's "MORTH
   * NANDYAL" creating two Project rows for the same real site. */
  async bulkReassignProject(fromProjectId: string, toProjectId: string, renameTo?: string) {
    if (fromProjectId === toProjectId) throw badRequest("Pick two different projects to reassign between.");
    const [fromProject, toProject] = await Promise.all([
      projectRepository.findById(fromProjectId),
      projectRepository.findById(toProjectId)
    ]);
    if (!fromProject || !toProject) throw notFound("One of the selected projects was not found");

    const result = await subStaffRepository.reassignProject(
      fromProjectId,
      fromProject.name,
      toProjectId,
      toProject.name
    );

    // Only ever remove the duplicate automatically once nothing real anywhere else in the app (Billing,
    // Financial, Letters, …) still depends on it — otherwise its onDelete: Cascade relations would wipe
    // out real records this tool never touched or even looked at.
    const otherReferences = await projectRepository.countOtherReferences(fromProjectId);
    let duplicateDeleted = false;
    let duplicateBlockedReason: string | undefined;
    if (otherReferences === 0) {
      await projectRepository.delete(fromProjectId);
      duplicateDeleted = true;
    } else {
      duplicateBlockedReason = `"${fromProject.name}" still has ${otherReferences} other record(s) linked to it elsewhere (Billing, Financial, Letters, …) — not deleted automatically, and the kept project wasn't renamed to avoid a name clash. Clear those first, or delete it from Admin > Projects once they're gone.`;
    }

    let toProjectName = toProject.name;
    if (duplicateDeleted && renameTo?.trim() && renameTo.trim() !== toProject.name) {
      const renamed = await projectService.update(toProjectId, { name: renameTo.trim() });
      toProjectName = renamed.name;
    }

    return {
      updatedCount: result.count,
      fromProjectName: fromProject.name,
      toProjectName,
      duplicateDeleted,
      duplicateBlockedReason
    };
  },

  /** Data-cleanup helper: renames a designation across every record that uses it (e.g. fixing "CAD
   * EXPERT" / "CAD Expert" typed inconsistently during import into one canonical spelling). */
  async bulkRenameDesignation(fromDesignation: string, toDesignation: string) {
    const result = await subStaffRepository.renameDesignation(fromDesignation, toDesignation);
    return { updatedCount: result.count };
  },

  /** Known ways the register marks an unfilled position — matched loosely since the real data has
   * several casing variants ("TO BE NAME", "To Be Name", ...). */
  _isOpenSlotName(staffName: string): boolean {
    const name = staffName.trim().toLowerCase();
    return name.includes("to be name") || name.includes("tbd") || name === "vacant";
  },

  /**
   * Once a person is fully done with a site (both phases completed), this looks for other ACTIVE
   * assignments in the same designation that are still unfilled placeholder rows ("TO BE NAME") — so
   * their next posting can be suggested instead of leaving them idle. When there's more than one
   * candidate, also asks the AI (if configured) to rank them by remaining time and rate; with 0 or 1
   * candidates there's nothing to rank, so the AI is skipped entirely to avoid spending a call on it.
   */
  async getReassignmentSuggestions(assignmentId: string) {
    const assignment = await subStaffRepository.findById(assignmentId);
    if (!assignment) throw notFound("Assignment not found");
    const asOf = new Date();
    const metrics = computeMetrics(assignment, asOf);
    if (metrics.remainingConsMonths > 0 || metrics.remainingDlpMonths > 0) {
      throw badRequest("This assignment isn't completed yet — reassignment suggestions are for completed ones.");
    }

    const sameDesignation = await subStaffRepository.list({ status: "ACTIVE", designation: assignment.designation });
    const openSlots = sameDesignation.filter(
      (row) =>
        row.id !== assignmentId &&
        row.designation.trim().toLowerCase() === assignment.designation.trim().toLowerCase() &&
        this._isOpenSlotName(row.staffName)
    );

    const candidates = openSlots.map((row) => ({
      assignmentId: row.id,
      siteName: row.siteName,
      designation: row.designation,
      rate: row.rate,
      metrics: computeMetrics(row, asOf)
    }));

    let recommendation = "";
    if (candidates.length > 1 && env.OPENROUTER_API_KEY) {
      const lines = candidates
        .map(
          (c, i) =>
            `${i + 1}. assignmentId=${c.assignmentId} | Project: ${c.siteName} | Rate: ${c.rate}/month | ` +
            `Remaining Construction Months: ${c.metrics.remainingConsMonths.toFixed(2)} | Remaining DLP Months: ${c.metrics.remainingDlpMonths.toFixed(2)}`
        )
        .join("\n");
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
          body: JSON.stringify({
            model: env.OPENROUTER_MODEL,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "You help an accounts team pick which open (unfilled) position a now-free staff member should move " +
                  "into next, from a short list of same-designation open slots. Prefer projects ending sooner and worth " +
                  "more. Reply with one short plain-language paragraph only, no JSON, no lists."
              },
              {
                role: "user",
                content: `${assignment.staffName} just finished ${assignment.siteName} (${assignment.designation}). Open slots:\n${lines}`
              }
            ]
          })
        });
        if (response.ok) {
          const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          recommendation = payload.choices?.[0]?.message?.content ?? "";
        } else {
          logger.warn({ status: response.status }, "OpenRouter reassignment-suggestion request failed");
        }
      } catch (error) {
        logger.warn({ err: error }, "OpenRouter reassignment-suggestion unavailable");
      }
    }

    return {
      completedAssignment: { staffName: assignment.staffName, siteName: assignment.siteName, designation: assignment.designation },
      candidates: candidates.map((c) => ({
        assignmentId: c.assignmentId,
        siteName: c.siteName,
        designation: c.designation,
        rate: c.rate,
        remainingConsMonths: c.metrics.remainingConsMonths,
        remainingDlpMonths: c.metrics.remainingDlpMonths
      })),
      recommendation
    };
  },

  /** Fills an open "TO BE NAME" slot with a now-free staff member — just renames that placeholder row,
   * it's still the same assignment/site/designation, just no longer vacant. */
  async fillOpenSlot(openSlotAssignmentId: string, staffName: string) {
    if (!staffName.trim()) throw badRequest("Staff name is required");
    const existing = await subStaffRepository.findById(openSlotAssignmentId);
    if (!existing) throw notFound("Open slot assignment not found");
    const updated = await subStaffRepository.update(openSlotAssignmentId, { staffName: staffName.trim() });
    return serializeAssignment(updated);
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
        plannedDaysConstruction: plan?.plannedDaysConstruction ?? 0,
        plannedDaysDlp: plan?.plannedDaysDlp ?? 0,
        autoPlanned: plan?.autoPlanned ?? true
      };
    });
  }
};
