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
  findByNameCaseInsensitive(name: string) {
    return prisma.project.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  },
  findFirstByProjectNumber(projectNumber: string) {
    return prisma.project.findFirst({
      where: { projectNumber },
      orderBy: { createdAt: "desc" }
    });
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
  },

  /** How many records elsewhere in the app (Billing, Financial, Letters, …) still point at this
   * project — used before an automatic delete, so a duplicate is only ever removed once nothing real
   * depends on it. Deliberately excludes SubStaffAssignment, whose own reassignment is handled by the
   * caller first. */
  async countOtherReferences(projectId: string): Promise<number> {
    const counts = await Promise.all([
      prisma.projectAssignment.count({ where: { projectId } }),
      prisma.infraProjectOtherCost.count({ where: { projectId } }),
      prisma.projectRequisitionForm.count({ where: { projectId } }),
      prisma.projectFinancialPlan.count({ where: { projectId } }),
      prisma.projectDprOverview.count({ where: { projectId } }),
      prisma.expenseSheet.count({ where: { projectId } }),
      prisma.projectBillingEntry.count({ where: { projectId } }),
      prisma.letterProject.count({ where: { linkedProjectId: projectId } }),
      prisma.contractActivity.count({ where: { linkedProjectId: projectId } })
    ]);
    return counts.reduce((sum, c) => sum + c, 0);
  }
};