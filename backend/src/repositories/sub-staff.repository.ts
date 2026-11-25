import { prisma } from "../prisma/client.js";
import type { Prisma, SubStaffAssignmentStatus } from "@prisma/client";

export const subStaffRepository = {
  list(filters: { status?: SubStaffAssignmentStatus; staffName?: string; siteName?: string }) {
    return prisma.subStaffAssignment.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.staffName ? { staffName: { contains: filters.staffName, mode: "insensitive" } } : {}),
        ...(filters.siteName ? { siteName: { contains: filters.siteName, mode: "insensitive" } } : {})
      },
      include: { inputPlans: true },
      orderBy: [{ staffName: "asc" }, { sortOrder: "asc" }]
    });
  },

  findById(id: string) {
    return prisma.subStaffAssignment.findUnique({ where: { id }, include: { inputPlans: true } });
  },

  nextSortOrder() {
    return prisma.subStaffAssignment.aggregate({ _max: { sortOrder: true } }).then((r) => (r._max.sortOrder ?? 0) + 1);
  },

  create(data: Prisma.SubStaffAssignmentUncheckedCreateInput) {
    return prisma.subStaffAssignment.create({ data });
  },

  update(id: string, data: Prisma.SubStaffAssignmentUncheckedUpdateInput) {
    return prisma.subStaffAssignment.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.subStaffAssignment.delete({ where: { id } });
  },

  upsertPlan(assignmentId: string, year: number, month: number, plannedDays: number, autoPlanned: boolean) {
    return prisma.subStaffInputPlan.upsert({
      where: { assignmentId_year_month: { assignmentId, year, month } },
      create: { assignmentId, year, month, plannedDays, autoPlanned },
      update: { plannedDays, autoPlanned }
    });
  },

  listPlansForMonth(year: number, month: number) {
    return prisma.subStaffInputPlan.findMany({
      where: { year, month },
      include: { assignment: true }
    });
  }
};
