import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const dprOverviewRepository = {
  findMany() {
    return prisma.projectDprOverview.findMany({ orderBy: { createdAt: "desc" } });
  },
  findById(id: string) {
    return prisma.projectDprOverview.findUnique({ where: { id } });
  },
  findByProjectId(projectId: string) {
    return prisma.projectDprOverview.findUnique({ where: { projectId } });
  },
  create(data: Prisma.ProjectDprOverviewCreateInput) {
    return prisma.projectDprOverview.create({ data });
  },
  update(id: string, data: Prisma.ProjectDprOverviewUncheckedUpdateInput) {
    return prisma.projectDprOverview.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.projectDprOverview.delete({ where: { id } });
  }
};
