import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const projectRepository = {
  findMany() {
    return prisma.project.findMany({ orderBy: { name: "asc" } });
  },
  findWithoutNumber() {
    return prisma.project.findMany({
      where: { projectNumber: null },
      orderBy: { name: "asc" }
    });
  },
  findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },
  findByName(name: string) {
    return prisma.project.findUnique({ where: { name } });
  },
  create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({ data });
  },
  update(id: string, data: Prisma.ProjectUncheckedUpdateInput) {
    return prisma.project.update({ where: { id }, data });
  },
  findMaxSerialForPrefixYear(projectCodePrefix: string, financialYearShort: number) {
    return prisma.project.findFirst({
      where: {
        projectCodePrefix,
        financialYearShort,
        serialNumber: { not: null }
      },
      orderBy: { serialNumber: "desc" }
    });
  },
  assignNumber(
    id: string,
    data: {
      projectNumber: string;
      projectCodePrefix: string;
      companyCode: string;
      technicalUnitCode: string;
      subTechnicalUnitCode: string;
      workCategoryCode: string;
      financialYearShort: number;
      serialNumber: number;
      projectNumberAssignedAt: Date;
    }
  ) {
    return prisma.project.update({
      where: { id },
      data
    });
  },
  delete(id: string) {
    return prisma.project.delete({ where: { id } });
  }
};