import { prisma } from "../prisma/client.js";
import type { Prisma, SubStaffAssignmentStatus } from "@prisma/client";

const projectSelect = { id: true, name: true, projectNumber: true } as const;

export const subStaffRepository = {
  list(filters: {
    status?: SubStaffAssignmentStatus;
    staffName?: string;
    siteName?: string;
    designation?: string;
  }) {
    return prisma.subStaffAssignment.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.staffName ? { staffName: { contains: filters.staffName, mode: "insensitive" } } : {}),
        ...(filters.siteName ? { siteName: { contains: filters.siteName, mode: "insensitive" } } : {}),
        ...(filters.designation ? { designation: { contains: filters.designation, mode: "insensitive" } } : {})
      },
      include: { inputPlans: true, project: { select: projectSelect } },
      orderBy: [{ staffName: "asc" }, { sortOrder: "asc" }]
    });
  },

  findById(id: string) {
    return prisma.subStaffAssignment.findUnique({
      where: { id },
      include: { inputPlans: true, project: { select: projectSelect } }
    });
  },

  /** Known designations already in use, for the picker's dropdown (seeded list is merged on top in the service). */
  async distinctDesignations() {
    const rows = await prisma.subStaffAssignment.findMany({
      where: { designation: { not: "" } },
      select: { designation: true },
      distinct: ["designation"]
    });
    return rows.map((r) => r.designation.trim()).filter(Boolean);
  },

  async distinctStaffNames() {
    const rows = await prisma.subStaffAssignment.findMany({
      where: { staffName: { not: "" } },
      select: { staffName: true },
      distinct: ["staffName"]
    });
    return rows.map((r) => r.staffName.trim()).filter(Boolean);
  },

  nextSortOrder() {
    return prisma.subStaffAssignment.aggregate({ _max: { sortOrder: true } }).then((r) => (r._max.sortOrder ?? 0) + 1);
  },

  create(data: Prisma.SubStaffAssignmentUncheckedCreateInput) {
    return prisma.subStaffAssignment.create({ data, include: { project: { select: projectSelect } } });
  },

  update(id: string, data: Prisma.SubStaffAssignmentUncheckedUpdateInput) {
    return prisma.subStaffAssignment.update({
      where: { id },
      data,
      include: { project: { select: projectSelect } }
    });
  },

  delete(id: string) {
    return prisma.subStaffAssignment.delete({ where: { id } });
  },

  upsertPlan(
    assignmentId: string,
    year: number,
    month: number,
    values: { plannedDaysConstruction: number; plannedDaysDlp: number },
    autoPlanned: boolean
  ) {
    return prisma.subStaffInputPlan.upsert({
      where: { assignmentId_year_month: { assignmentId, year, month } },
      create: { assignmentId, year, month, ...values, autoPlanned },
      update: { ...values, autoPlanned }
    });
  },

  listPlansForMonth(year: number, month: number) {
    return prisma.subStaffInputPlan.findMany({
      where: { year, month },
      include: { assignment: true }
    });
  }
};
