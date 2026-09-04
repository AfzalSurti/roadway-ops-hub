import type { HoursRequestStatus, LeaveType } from "@prisma/client";
import { hoursRepository } from "../repositories/hours.repository.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import {
  LEAVE_DURATION_MINUTES,
  combineDateAndTime,
  daysBetweenInclusive,
  minutesToLabel,
  now,
  parseHoursDate,
  periodBoundsForDate
} from "../utils/hours.js";

type LeaveRow = { id: string; startDate: Date; leaveType: LeaveType; durationMinutes: number };
type OvertimeRow = { id: string; date: Date; durationMinutes: number };

/** FIFO allocation: oldest approved leave is covered first, drawing from approved overtime in date order. */
function allocateOvertimeToLeave(leaves: LeaveRow[], overtimes: OvertimeRow[]) {
  const sortedLeaves = [...leaves].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const sortedOvertimes = [...overtimes].sort((a, b) => a.date.getTime() - b.date.getTime());

  const overtimeRemaining = new Map(sortedOvertimes.map((o) => [o.id, o.durationMinutes]));
  const leaveCovered = new Map<string, number>(sortedLeaves.map((l) => [l.id, 0]));
  const allocations: Array<{ leaveId: string; overtimeId: string; minutesApplied: number }> = [];

  let otIndex = 0;
  for (const leave of sortedLeaves) {
    let remainingToCover = leave.durationMinutes;
    while (remainingToCover > 0 && otIndex < sortedOvertimes.length) {
      const ot = sortedOvertimes[otIndex];
      const otRemaining = overtimeRemaining.get(ot.id) ?? 0;
      if (otRemaining <= 0) {
        otIndex += 1;
        continue;
      }
      const applied = Math.min(otRemaining, remainingToCover);
      allocations.push({ leaveId: leave.id, overtimeId: ot.id, minutesApplied: applied });
      overtimeRemaining.set(ot.id, otRemaining - applied);
      leaveCovered.set(leave.id, (leaveCovered.get(leave.id) ?? 0) + applied);
      remainingToCover -= applied;
      if ((overtimeRemaining.get(ot.id) ?? 0) <= 0) otIndex += 1;
    }
  }

  return { allocations, leaveCovered, overtimeRemaining };
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

  async createLeaveRequest(employeeId: string, payload: { startDate: string; endDate: string; leaveType: LeaveType }) {
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
    const created = await hoursRepository.createLeaveRequest({
      employeeId,
      calculationPeriodId: period.id,
      startDate,
      endDate,
      numberOfDays,
      leaveType: payload.leaveType,
      durationMinutes,
      status: "PENDING"
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
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
    if (durationMinutes <= 0) throw badRequest("End time must be after start time");

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
    const [allLeaves, allOvertimes] = await Promise.all([
      hoursRepository.listLeaveRequests({ employeeId, calculationPeriodId: period.id }),
      hoursRepository.listOvertimeRequests({ employeeId, calculationPeriodId: period.id })
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
    const remainingMinutes = totalLeaveMinutes - approvedOvertimeMinutes;

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
      remainingMinutes,
      remainingLabel: minutesToLabel(remainingMinutes),
      pendingCount
    };
  },

  /** Date-wise FIFO allocation of approved overtime against approved leave for a period. */
  async getEmployeeBreakdown(employeeId: string, period: { id: string }) {
    const [leaves, overtimes] = await Promise.all([
      hoursRepository.listLeaveRequests({ employeeId, calculationPeriodId: period.id, status: "APPROVED" }),
      hoursRepository.listOvertimeRequests({ employeeId, calculationPeriodId: period.id, status: "APPROVED" })
    ]);

    const { allocations, leaveCovered, overtimeRemaining } = allocateOvertimeToLeave(leaves, overtimes);

    const leaveBreakdown = [...leaves]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((leave) => {
        const covered = leaveCovered.get(leave.id) ?? 0;
        const remaining = leave.durationMinutes - covered;
        return {
          id: leave.id,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          numberOfDays: leave.numberOfDays,
          leaveType: leave.leaveType,
          durationMinutes: leave.durationMinutes,
          durationLabel: minutesToLabel(leave.durationMinutes),
          coveredMinutes: covered,
          coveredLabel: minutesToLabel(covered),
          remainingMinutes: Math.max(remaining, 0),
          coverageStatus:
            remaining <= 0 ? ("COVERED" as const) : covered > 0 ? ("PARTIALLY_COVERED" as const) : ("NOT_COVERED" as const)
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
        const [summary, breakdown] = await Promise.all([
          this.getEmployeeSummary(employee.id, period),
          this.getEmployeeBreakdown(employee.id, { id: period.id })
        ]);
        return { employee, ...summary, ...breakdown };
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
  }
};
