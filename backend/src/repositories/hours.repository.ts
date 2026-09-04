import type { HoursRequestStatus, LeaveType, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

const employeeSelect = { id: true, name: true, email: true } as const;

export const hoursRepository = {
  // ─── Calculation periods ────────────────────────────────────────────────

  findPeriodByBounds(startDate: Date, endDate: Date) {
    return prisma.calculationPeriod.findUnique({
      where: { startDate_endDate: { startDate, endDate } }
    });
  },

  findActivePeriod() {
    return prisma.calculationPeriod.findFirst({ where: { status: "ACTIVE" } });
  },

  listActivePeriodsExcept(startDate: Date, endDate: Date) {
    return prisma.calculationPeriod.findMany({
      where: { status: "ACTIVE", NOT: { startDate, endDate } }
    });
  },

  createPeriod(data: { startDate: Date; endDate: Date; status: "ACTIVE" | "CLOSED" }) {
    return prisma.calculationPeriod.create({ data });
  },

  closePeriod(id: string) {
    return prisma.calculationPeriod.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() }
    });
  },

  listPeriods() {
    return prisma.calculationPeriod.findMany({ orderBy: { startDate: "desc" } });
  },

  // ─── Leave requests ─────────────────────────────────────────────────────

  /** Any active (pending/approved) leave whose [startDate,endDate] overlaps the given range. */
  findOverlappingLeave(employeeId: string, startDate: Date, endDate: Date) {
    return prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });
  },

  createLeaveRequest(data: Prisma.LeaveRequestUncheckedCreateInput) {
    return prisma.leaveRequest.create({
      data,
      include: { employee: { select: employeeSelect } }
    });
  },

  findLeaveById(id: string) {
    return prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: employeeSelect }, calculationPeriod: true }
    });
  },

  updateLeaveStatus(
    id: string,
    data: { status: HoursRequestStatus; approvedById: string | null; approvedAt: Date | null; rejectionReason: string | null }
  ) {
    return prisma.leaveRequest.update({
      where: { id },
      data,
      include: { employee: { select: employeeSelect } }
    });
  },

  listLeaveRequests(where: Prisma.LeaveRequestWhereInput) {
    return prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: employeeSelect } },
      orderBy: { startDate: "asc" }
    });
  },

  // ─── Overtime requests ──────────────────────────────────────────────────

  findActiveOvertimeOnDate(employeeId: string, date: Date) {
    return prisma.overtimeRequest.findFirst({
      where: { employeeId, date, status: { in: ["PENDING", "APPROVED"] } }
    });
  },

  createOvertimeRequest(data: Prisma.OvertimeRequestUncheckedCreateInput) {
    return prisma.overtimeRequest.create({
      data,
      include: { employee: { select: employeeSelect } }
    });
  },

  findOvertimeById(id: string) {
    return prisma.overtimeRequest.findUnique({
      where: { id },
      include: { employee: { select: employeeSelect }, calculationPeriod: true }
    });
  },

  updateOvertimeStatus(
    id: string,
    data: { status: HoursRequestStatus; approvedById: string | null; approvedAt: Date | null; rejectionReason: string | null }
  ) {
    return prisma.overtimeRequest.update({
      where: { id },
      data,
      include: { employee: { select: employeeSelect } }
    });
  },

  listOvertimeRequests(where: Prisma.OvertimeRequestWhereInput) {
    return prisma.overtimeRequest.findMany({
      where,
      include: { employee: { select: employeeSelect } },
      orderBy: { date: "asc" }
    });
  },

  listEmployees() {
    return prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      select: employeeSelect,
      orderBy: { name: "asc" }
    });
  }
};

export type { LeaveType };
