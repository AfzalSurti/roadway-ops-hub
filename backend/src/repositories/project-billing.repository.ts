import { prisma } from "../prisma/client.js";
import type { Prisma } from "@prisma/client";

export const projectBillingRepository = {
  listByProject(projectId: string) {
    return prisma.projectBillingEntry.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" }
    });
  },

  findById(id: string) {
    return prisma.projectBillingEntry.findUnique({ where: { id } });
  },

  nextSortOrder(projectId: string) {
    return prisma.projectBillingEntry
      .aggregate({ where: { projectId }, _max: { sortOrder: true } })
      .then((r) => (r._max.sortOrder ?? 0) + 1);
  },

  create(data: Prisma.ProjectBillingEntryUncheckedCreateInput) {
    return prisma.projectBillingEntry.create({ data });
  },

  update(id: string, data: Prisma.ProjectBillingEntryUncheckedUpdateInput) {
    return prisma.projectBillingEntry.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.projectBillingEntry.delete({ where: { id } });
  },

  /** Every project that has at least one bill, plus its identifying info, for the summary view. */
  listProjectsWithEntries() {
    return prisma.project.findMany({
      where: { billingEntries: { some: {} } },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        billingEntries: { orderBy: { sortOrder: "asc" } }
      },
      orderBy: { name: "asc" }
    });
  }
};
