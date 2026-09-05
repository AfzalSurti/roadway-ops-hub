import type { HoursRequestStatus, LeaveType } from "@prisma/client";
import { hoursRepository } from "../repositories/hours.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import {
  LEAVE_DURATION_MINUTES,
  combineDateAndTime,
  computeOvertimeMinutes,
  daysBetweenInclusive,
  isPeriodSettleable,
  minutesToLabel,
  now,
  parseHoursDate,
  periodBoundsForDate
} from "../utils/hours.js";

type LeaveRow = { id: string; startDate: Date; createdAt: Date; leaveType: LeaveType; durationMinutes: number };
type OvertimeRow = { id: string; date: Date; durationMinutes: number };

/** Client rule: the first 2 approved Short Leaves in a period are auto-exempt — no overtime needed. */
const FREE_SHORT_LEAVES_PER_PERIOD = 2;

/** Client rule: leave coverage priority is Half Day -> Full Day -> Short Leave (excess beyond the free 2). */
const LEAVE_COVERAGE_PRIORITY: Record<LeaveType, number> = { HALF_DAY: 0, FULL_DAY: 1, SHORT_LEAVE: 2 };

/**
 * Two-pass FIFO leave coverage:
 *  - The first 2 Short Leaves SUBMITTED in a period are exempt (auto-approved at creation, "P", no
 *    adjustment needed) — same submission-order used at creation time in createLeaveRequest, so the
 *    two mechanisms never disagree about which Short Leaves are "the free 2".
 *  - Remaining leave is sorted by client priority (HL -> L -> SL) then oldest-first, and covered first
 *    by real approved overtime, then by whatever an admin has manually converted ("OL").
 */
function allocateLeaveCoverage(leaves: LeaveRow[], overtimes: OvertimeRow[], convertedMinutes: number) {
  const freeSlIds = new Set(
    leaves
      .filter((l) => l.leaveType === "SHORT_LEAVE")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, FREE_SHORT_LEAVES_PER_PERIOD)
      .map((l) => l.id)
  );

  const needingCoverage = leaves
    .filter((l) => !freeSlIds.has(l.id))
    .sort((a, b) => {
      const priorityDiff = LEAVE_COVERAGE_PRIORITY[a.leaveType] - LEAVE_COVERAGE_PRIORITY[b.leaveType];
      return priorityDiff !== 0 ? priorityDiff : a.startDate.getTime() - b.startDate.getTime();
    });

  const sortedOvertimes = [...overtimes].sort((a, b) => a.date.getTime() - b.date.getTime());
  const overtimeRemaining = new Map(sortedOvertimes.map((o) => [o.id, o.durationMinutes]));
  const coveredByOt = new Map<string, number>(leaves.map((l) => [l.id, 0]));
  const allocations: Array<{ leaveId: string; overtimeId: string; minutesApplied: number }> = [];

  // Pass 1 — real approved overtime, in priority order.
  let otIndex = 0;
  for (const leave of needingCoverage) {
    let remaining = leave.durationMinutes;
    while (remaining > 0 && otIndex < sortedOvertimes.length) {
      const ot = sortedOvertimes[otIndex];
      const otRemaining = overtimeRemaining.get(ot.id) ?? 0;
      if (otRemaining <= 0) {
        otIndex += 1;
        continue;
      }
      const applied = Math.min(otRemaining, remaining);
      allocations.push({ leaveId: leave.id, overtimeId: ot.id, minutesApplied: applied });
      overtimeRemaining.set(ot.id, otRemaining - applied);
      coveredByOt.set(leave.id, (coveredByOt.get(leave.id) ?? 0) + applied);
      remaining -= applied;
      if ((overtimeRemaining.get(ot.id) ?? 0) <= 0) otIndex += 1;
    }
  }

  // Pass 2 — admin-converted balance settles whatever's still outstanding, same priority order.
  const coveredByOl = new Map<string, number>(leaves.map((l) => [l.id, 0]));
  let olPool = convertedMinutes;
  for (const leave of needingCoverage) {
    if (olPool <= 0) break;
    const stillNeeded = leave.durationMinutes - (coveredByOt.get(leave.id) ?? 0);
    if (stillNeeded <= 0) continue;
    const applied = Math.min(olPool, stillNeeded);
    coveredByOl.set(leave.id, applied);
    olPool -= applied;
  }

  return { freeSlIds, coveredByOt, coveredByOl, overtimeRemaining, allocations };
}

function serializeLeave(leave: {
  id: string;
  employeeId: string;
  calculationPeriodId: string;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  leaveType: LeaveType;
  durationMinutes: number;
  reason: string;
  status: HoursRequestStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; name: string; email: string };
}) {
  return {
    id: leave.id,
    requestType: "LEAVE" as const,
    employeeId: leave.employeeId,
    employee: leave.employee,
    calculationPeriodId: leave.calculationPeriodId,
    // "date" mirrors startDate — a single sortable/displayable date for the combined admin feed.
    date: leave.startDate.toISOString(),
    startDate: leave.startDate.toISOString(),
    endDate: leave.endDate.toISOString(),
    numberOfDays: leave.numberOfDays,
    leaveType: leave.leaveType,
    durationMinutes: leave.durationMinutes,
    reason: leave.reason,
    durationLabel: minutesToLabel(leave.durationMinutes),
    status: leave.status,
    approvedById: leave.approvedById,
    approvedAt: leave.approvedAt ? leave.approvedAt.toISOString() : null,
    rejectionReason: leave.rejectionReason,
    createdAt: leave.createdAt.toISOString(),
    updatedAt: leave.updatedAt.toISOString()
  };
}

function serializeOvertime(overtime: {
  id: string;
  employeeId: string;
  calculationPeriodId: string;
  date: Date;
  project: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  durationMinutes: number;
  status: HoursRequestStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; name: string; email: string };
}) {
  return {
    id: overtime.id,
    requestType: "OVERTIME" as const,
    employeeId: overtime.employeeId,
    employee: overtime.employee,
    calculationPeriodId: overtime.calculationPeriodId,
    date: overtime.date.toISOString(),
    project: overtime.project,
    startTime: overtime.startTime.toISOString(),
    endTime: overtime.endTime.toISOString(),
    reason: overtime.reason,
    durationMinutes: overtime.durationMinutes,
    durationLabel: minutesToLabel(overtime.durationMinutes),
    status: overtime.status,
    approvedById: overtime.approvedById,
    approvedAt: overtime.approvedAt ? overtime.approvedAt.toISOString() : null,
    rejectionReason: overtime.rejectionReason,
    createdAt: overtime.createdAt.toISOString(),
    updatedAt: overtime.updatedAt.toISOString()
  };
}

function serializeConvertedLeave(row: {
  id: string;
  employeeId: string;
  calculationPeriodId: string;
  durationMinutes: number;
  reason: string;
  convertedById: string;
  convertedAt: Date;
  createdAt: Date;
  employee: { id: string; name: string; email: string };
  convertedBy: { id: string; name: string; email: string };
  calculationPeriod?: { id: string; startDate: Date; endDate: Date };
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employee: row.employee,
    calculationPeriodId: row.calculationPeriodId,
    calculationPeriod: row.calculationPeriod
      ? {
          id: row.calculationPeriod.id,
          startDate: row.calculationPeriod.startDate.toISOString(),
          endDate: row.calculationPeriod.endDate.toISOString()
        }
      : undefined,
    durationMinutes: row.durationMinutes,
    durationLabel: minutesToLabel(row.durationMinutes),
    reason: row.reason,
    convertedById: row.convertedById,
    convertedBy: row.convertedBy,
    convertedAt: row.convertedAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

export const hoursService = {
  // ─── Calculation period resolution ──────────────────────────────────────

  /** Resolves (and lazily creates) the single ACTIVE cycle for "now", closing any stale ACTIVE rows. */
  async getActivePeriod() {
    const bounds = periodBoundsForDate(now());

    const stale = await hoursRepository.listActivePeriodsExcept(bounds.startDate, bounds.endDate);
    if (stale.length > 0) {
      await Promise.all(stale.map((period) => hoursRepository.closePeriod(period.id)));
    }

    const existing = await hoursRepository.findPeriodByBounds(bounds.startDate, bounds.endDate);
    if (existing) {
      if (existing.status !== "ACTIVE") return existing; // defensive — should not happen
      return existing;
    }

    return hoursRepository.createPeriod({ ...bounds, status: "ACTIVE" });
  },

  listPeriods() {
    return hoursRepository.listPeriods();
  },

  // ─── Leave requests ──────────────────────────────────────────────────────

  async createLeaveRequest(
    employeeId: string,
    payload: { startDate: string; endDate: string; leaveType: LeaveType; reason: string }
  ) {
    const startDate = parseHoursDate(payload.startDate);
    const endDate = parseHoursDate(payload.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw badRequest("End date cannot be before start date");
    }

    const period = await this.getActivePeriod();
    if (startDate.getTime() < period.startDate.getTime() || endDate.getTime() > period.endDate.getTime()) {
      throw badRequest("Selected dates are outside the active calculation period");
    }

    const overlap = await hoursRepository.findOverlappingLeave(employeeId, startDate, endDate);
    if (overlap) {
      throw conflict("An overlapping leave request already exists for these dates");
    }

    const numberOfDays = daysBetweenInclusive(startDate, endDate);
    const durationMinutes = numberOfDays * LEAVE_DURATION_MINUTES[payload.leaveType];

    // Client rule: the first 2 Short Leaves submitted in a period need no admin approval at all —
    // they're auto-fulfilled immediately, no overtime required either (see allocateLeaveCoverage).
    let autoApproved = false;
    if (payload.leaveType === "SHORT_LEAVE") {
      const existingShortLeaves = await hoursRepository.listLeaveRequests({
        employeeId,
        calculationPeriodId: period.id,
        leaveType: "SHORT_LEAVE",
        status: { in: ["PENDING", "APPROVED"] }
      });
      autoApproved = existingShortLeaves.length < FREE_SHORT_LEAVES_PER_PERIOD;
    }

    const created = await hoursRepository.createLeaveRequest({
      employeeId,
      calculationPeriodId: period.id,
      startDate,
      endDate,
      numberOfDays,
      leaveType: payload.leaveType,
      durationMinutes,
      reason: payload.reason.trim(),
      status: autoApproved ? "APPROVED" : "PENDING",
      approvedAt: autoApproved ? new Date() : null
    });
    return serializeLeave(created);
  },

  async listMyLeaveRequests(employeeId: string) {
    const period = await this.getActivePeriod();
    const rows = await hoursRepository.listLeaveRequests({ employeeId, calculationPeriodId: period.id });
    return rows.map(serializeLeave);
  },

  async listAdminLeaveRequests(filters: {
    employeeId?: string;
    periodId?: string;
    leaveType?: LeaveType;
    status?: HoursRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const rows = await hoursRepository.listLeaveRequests({
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.periodId ? { calculationPeriodId: filters.periodId } : {}),
      ...(filters.leaveType ? { leaveType: filters.leaveType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      // A leave "matches" a date filter when its [startDate,endDate] range overlaps it.
      ...(filters.dateTo ? { startDate: { lte: parseHoursDate(filters.dateTo) } } : {}),
      ...(filters.dateFrom ? { endDate: { gte: parseHoursDate(filters.dateFrom) } } : {})
    });
    return rows.map(serializeLeave);
  },

  async reviewLeaveRequest(id: string, approverId: string, approve: boolean, rejectionReason?: string) {
    const leave = await hoursRepository.findLeaveById(id);
    if (!leave) throw notFound("Leave request not found");
    if (leave.status !== "PENDING") throw badRequest("This leave request has already been reviewed");

    const updated = await hoursRepository.updateLeaveStatus(id, {
      status: approve ? "APPROVED" : "REJECTED",
      approvedById: approverId,
      approvedAt: new Date(),
      rejectionReason: approve ? null : rejectionReason?.trim() || null
    });
    return serializeLeave(updated);
  },

  // ─── Overtime requests ────────────────────────────────────────────────────

  async createOvertimeRequest(
    employeeId: string,
    payload: { date: string; project: string; startTime: string; endTime: string; reason: string }
  ) {
    const date = parseHoursDate(payload.date);
    const startTime = combineDateAndTime(payload.date, payload.startTime);
    const endTime = combineDateAndTime(payload.date, payload.endTime);
    if (endTime.getTime() <= startTime.getTime()) throw badRequest("End time must be after start time");
    // Client rule: only time worked after 19:00 counts, and only when at least 1h of it qualifies —
    // the request is still recorded even when that comes out to 0 (shown as "-" in reports).
    const durationMinutes = computeOvertimeMinutes(startTime, endTime);

    const period = await this.getActivePeriod();
    if (date.getTime() < period.startDate.getTime() || date.getTime() > period.endDate.getTime()) {
      throw badRequest("Selected date is outside the active calculation period");
    }

    const duplicate = await hoursRepository.findActiveOvertimeOnDate(employeeId, date);
    if (duplicate) {
      throw conflict("An overtime request already exists for this date");
    }

    const created = await hoursRepository.createOvertimeRequest({
      employeeId,
      calculationPeriodId: period.id,
      date,
      project: payload.project.trim(),
      startTime,
      endTime,
      reason: payload.reason.trim(),
      durationMinutes,
      status: "PENDING"
    });
    return serializeOvertime(created);
  },

  async listMyOvertimeRequests(employeeId: string) {
    const period = await this.getActivePeriod();
    const rows = await hoursRepository.listOvertimeRequests({ employeeId, calculationPeriodId: period.id });
    return rows.map(serializeOvertime);
  },

  async listAdminOvertimeRequests(filters: {
    employeeId?: string;
    periodId?: string;
    status?: HoursRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const rows = await hoursRepository.listOvertimeRequests({
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.periodId ? { calculationPeriodId: filters.periodId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: parseHoursDate(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: parseHoursDate(filters.dateTo) } : {})
            }
          }
        : {})
    });
    return rows.map(serializeOvertime);
  },

  async reviewOvertimeRequest(id: string, approverId: string, approve: boolean, rejectionReason?: string) {
    const overtime = await hoursRepository.findOvertimeById(id);
    if (!overtime) throw notFound("Overtime request not found");
    if (overtime.status !== "PENDING") throw badRequest("This overtime request has already been reviewed");

    const updated = await hoursRepository.updateOvertimeStatus(id, {
      status: approve ? "APPROVED" : "REJECTED",
      approvedById: approverId,
      approvedAt: new Date(),
      rejectionReason: approve ? null : rejectionReason?.trim() || null
    });
    return serializeOvertime(updated);
  },

  // ─── Combined admin feed ───────────────────────────────────────────────────

  async listAdminRequests(filters: {
    employeeId?: string;
    periodId?: string;
    leaveType?: LeaveType;
    requestType?: "LEAVE" | "OVERTIME";
    status?: HoursRequestStatus;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const [leaves, overtimes] = await Promise.all([
      filters.requestType === "OVERTIME" ? [] : this.listAdminLeaveRequests(filters),
      filters.requestType === "LEAVE" ? [] : this.listAdminOvertimeRequests(filters)
    ]);
    return [...leaves, ...overtimes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },

  // ─── Summary + breakdown ────────────────────────────────────────────────

  /** Approved-only totals for an employee within a period — the numbers that matter for compensation. */
  async getEmployeeSummary(employeeId: string, period: { id: string; startDate: Date; endDate: Date; status: string }) {
    const [allLeaves, allOvertimes, convertedLeaves] = await Promise.all([
      hoursRepository.listLeaveRequests({ employeeId, calculationPeriodId: period.id }),
      hoursRepository.listOvertimeRequests({ employeeId, calculationPeriodId: period.id }),
      hoursRepository.listConvertedLeaves({ employeeId, calculationPeriodId: period.id })
    ]);

    const approvedLeaves = allLeaves.filter((l) => l.status === "APPROVED");
    const approvedOvertimes = allOvertimes.filter((o) => o.status === "APPROVED");

    const bucket = (type: LeaveType) => {
      const rows = approvedLeaves.filter((l) => l.leaveType === type);
      const minutes = rows.reduce((sum, l) => sum + l.durationMinutes, 0);
      return { count: rows.length, minutes, label: minutesToLabel(minutes) };
    };

    const fullDay = bucket("FULL_DAY");
    const halfDay = bucket("HALF_DAY");
    const shortLeave = bucket("SHORT_LEAVE");
    const totalLeaveMinutes = fullDay.minutes + halfDay.minutes + shortLeave.minutes;
    const totalLeaveCount = fullDay.count + halfDay.count + shortLeave.count;
    const approvedOvertimeMinutes = approvedOvertimes.reduce((sum, o) => sum + o.durationMinutes, 0);
    const convertedMinutes = convertedLeaves.reduce((sum, c) => sum + c.durationMinutes, 0);

    // Client rule: the first 2 Short Leaves submitted in a period need no coverage at all
    // (they're also auto-approved at creation — see createLeaveRequest).
    const freeShortLeaveMinutes = approvedLeaves
      .filter((l) => l.leaveType === "SHORT_LEAVE")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, FREE_SHORT_LEAVES_PER_PERIOD)
      .reduce((sum, l) => sum + l.durationMinutes, 0);
    const coverageRequiredMinutes = totalLeaveMinutes - freeShortLeaveMinutes;
    const remainingMinutes = coverageRequiredMinutes - approvedOvertimeMinutes - convertedMinutes;

    const pendingCount =
      allLeaves.filter((l) => l.status === "PENDING").length +
      allOvertimes.filter((o) => o.status === "PENDING").length;

    return {
      period: {
        id: period.id,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        status: period.status
      },
      leave: {
        fullDay,
        halfDay,
        shortLeave,
        totalCount: totalLeaveCount,
        totalMinutes: totalLeaveMinutes,
        totalLabel: minutesToLabel(totalLeaveMinutes)
      },
      approvedOvertimeMinutes,
      approvedOvertimeLabel: minutesToLabel(approvedOvertimeMinutes),
      convertedMinutes,
      convertedLabel: minutesToLabel(convertedMinutes),
      remainingMinutes,
      remainingLabel: minutesToLabel(remainingMinutes),
      canConvert: remainingMinutes > 0 && isPeriodSettleable(period.endDate),
      pendingCount
    };
  },

  /** Date-wise FIFO allocation of approved overtime (then admin-converted balance) against approved leave. */
  async getEmployeeBreakdown(employeeId: string, period: { id: string }) {
    const [leaves, overtimes, convertedLeaves] = await Promise.all([
      hoursRepository.listLeaveRequests({ employeeId, calculationPeriodId: period.id, status: "APPROVED" }),
      hoursRepository.listOvertimeRequests({ employeeId, calculationPeriodId: period.id, status: "APPROVED" }),
      hoursRepository.listConvertedLeaves({ employeeId, calculationPeriodId: period.id })
    ]);
    const convertedMinutes = convertedLeaves.reduce((sum, c) => sum + c.durationMinutes, 0);

    const { freeSlIds, coveredByOt, coveredByOl, overtimeRemaining, allocations } = allocateLeaveCoverage(
      leaves,
      overtimes,
      convertedMinutes
    );

    const leaveBreakdown = [...leaves]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((leave) => {
        const isFreeSl = freeSlIds.has(leave.id);
        const otCovered = coveredByOt.get(leave.id) ?? 0;
        const olCovered = coveredByOl.get(leave.id) ?? 0;
        const covered = isFreeSl ? leave.durationMinutes : otCovered + olCovered;
        const remaining = leave.durationMinutes - covered;
        const modification: "P" | "L" = remaining <= 0 ? "P" : "L";
        const adjustmentAgainst: "OT" | "OL" | "-" = isFreeSl ? "-" : olCovered > 0 ? "OL" : otCovered > 0 ? "OT" : "-";
        return {
          id: leave.id,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          numberOfDays: leave.numberOfDays,
          leaveType: leave.leaveType,
          reason: leave.reason,
          durationMinutes: leave.durationMinutes,
          durationLabel: minutesToLabel(leave.durationMinutes),
          coveredMinutes: covered,
          coveredLabel: minutesToLabel(covered),
          remainingMinutes: Math.max(remaining, 0),
          coverageStatus:
            remaining <= 0 ? ("COVERED" as const) : covered > 0 ? ("PARTIALLY_COVERED" as const) : ("NOT_COVERED" as const),
          modification,
          adjustmentAgainst
        };
      });

    const overtimeBreakdown = [...overtimes]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((overtime) => {
        const remaining = overtimeRemaining.get(overtime.id) ?? 0;
        const applied = overtime.durationMinutes - remaining;
        return {
          id: overtime.id,
          date: overtime.date.toISOString(),
          project: overtime.project,
          startTime: overtime.startTime.toISOString(),
          endTime: overtime.endTime.toISOString(),
          reason: overtime.reason,
          durationMinutes: overtime.durationMinutes,
          durationLabel: minutesToLabel(overtime.durationMinutes),
          appliedMinutes: applied,
          appliedLabel: minutesToLabel(applied),
          extraMinutes: Math.max(remaining, 0),
          extraLabel: minutesToLabel(Math.max(remaining, 0))
        };
      });

    const leaveById = new Map(leaves.map((l) => [l.id, l]));
    const overtimeById = new Map(overtimes.map((o) => [o.id, o]));
    const allocationRows = allocations.map((a) => {
      const leave = leaveById.get(a.leaveId)!;
      const overtime = overtimeById.get(a.overtimeId)!;
      return {
        leaveId: a.leaveId,
        leaveDate: leave.startDate.toISOString(),
        leaveType: leave.leaveType,
        overtimeId: a.overtimeId,
        overtimeDate: overtime.date.toISOString(),
        minutesApplied: a.minutesApplied,
        minutesAppliedLabel: minutesToLabel(a.minutesApplied)
      };
    });

    return { leaveBreakdown, overtimeBreakdown, allocations: allocationRows };
  },

  /** Combined summary + breakdown for an employee, resolving the period (active if unspecified). */
  async getEmployeeReport(employeeId: string, periodId?: string) {
    const period = periodId ? await this.getPeriodById(periodId) : await this.getActivePeriod();
    const [summary, breakdown] = await Promise.all([
      this.getEmployeeSummary(employeeId, period),
      this.getEmployeeBreakdown(employeeId, { id: period.id })
    ]);
    return { ...summary, ...breakdown };
  },

  async getPeriodById(periodId: string) {
    const periods = await hoursRepository.listPeriods();
    const period = periods.find((p) => p.id === periodId);
    if (!period) throw notFound("Calculation period not found");
    return period;
  },

  async getMyHoursSummary(employeeId: string) {
    const period = await this.getActivePeriod();
    return this.getEmployeeReport(employeeId, period.id);
  },

  /** Combined summary + breakdown for every employee in one period — powers the "Download All Employee Report" PDF. */
  async getAllEmployeesReport(periodId?: string) {
    const period = periodId ? await this.getPeriodById(periodId) : await this.getActivePeriod();
    const employees = await hoursRepository.listEmployees();

    const employeeReports = await Promise.all(
      employees.map(async (employee) => {
        const [summary, breakdown, convertedLeaves] = await Promise.all([
          this.getEmployeeSummary(employee.id, period),
          this.getEmployeeBreakdown(employee.id, { id: period.id }),
          hoursRepository.listConvertedLeaves({ employeeId: employee.id, calculationPeriodId: period.id })
        ]);
        return {
          employee,
          ...summary,
          ...breakdown,
          convertedLeaves: convertedLeaves.map(serializeConvertedLeave)
        };
      })
    );

    return {
      period: {
        id: period.id,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        status: period.status
      },
      employees: employeeReports
    };
  },

  // ─── Converted leave (admin settlement) ─────────────────────────────────

  /** Admin explicitly settles an employee's uncovered leave balance once the period has ended. */
  async convertUncoveredLeave(employeeId: string, periodId: string, adminId: string, reason: string) {
    const period = await this.getPeriodById(periodId);
    if (!isPeriodSettleable(period.endDate)) {
      throw badRequest("This calculation period has not closed yet");
    }

    const summary = await this.getEmployeeSummary(employeeId, period);
    const unconvertedMinutes = Math.max(summary.remainingMinutes, 0);
    if (unconvertedMinutes <= 0) {
      throw badRequest("No uncovered leave balance to convert");
    }

    const created = await hoursRepository.createConvertedLeave({
      employeeId,
      calculationPeriodId: period.id,
      durationMinutes: unconvertedMinutes,
      reason: reason.trim(),
      convertedById: adminId
    });

    const updatedSummary = await this.getEmployeeSummary(employeeId, period);
    return { ...updatedSummary, convertedLeave: serializeConvertedLeave(created) };
  },

  async listMyConvertedLeaves(employeeId: string) {
    const rows = await hoursRepository.listConvertedLeaves({ employeeId });
    return rows.map(serializeConvertedLeave);
  }
};
