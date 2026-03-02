import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const reportRepository = {
  create(data: Prisma.ReportUncheckedCreateInput) {
    return prisma.report.create({ data });
  },
  findById(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, email: true, name: true, role: true } },
        task: true,
        reportTemplate: true,
        attachments: true
      }
    });
  },
  update(id: string, data: Prisma.ReportUncheckedUpdateInput) {
    return prisma.report.update({ where: { id }, data });
  },
  findMany(where: Prisma.ReportWhereInput, skip: number, take: number) {
    return prisma.report.findMany({
      where,
      skip,
      take,
      include: {
        submittedBy: { select: { id: true, email: true, name: true, role: true } },
        task: true,
        reportTemplate: true,
        attachments: true
      },
      orderBy: { createdAt: "desc" }
    });
  },
  count(where: Prisma.ReportWhereInput) {
    return prisma.report.count({ where });
  }
};