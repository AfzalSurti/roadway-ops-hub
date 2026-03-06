import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const templateRepository = {
  create(data: Prisma.ReportTemplateUncheckedCreateInput) {
    return prisma.reportTemplate.create({ data });
  },
  findById(id: string) {
    return prisma.reportTemplate.findUnique({ where: { id } });
  },
  findByName(name: string) {
    return prisma.reportTemplate.findUnique({ where: { name } });
  },
  update(id: string, data: Prisma.ReportTemplateUncheckedUpdateInput) {
    return prisma.reportTemplate.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.reportTemplate.delete({ where: { id } });
  },
  findMany() {
    return prisma.reportTemplate.findMany({ orderBy: { createdAt: "desc" } });
  },
  findFirst() {
    return prisma.reportTemplate.findFirst({ orderBy: { createdAt: "asc" } });
  }
};