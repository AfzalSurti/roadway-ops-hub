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

  /** Move every project-owned record onto the canonical project before removing the duplicate.
   * The one-to-one records are moved only when the destination does not already have one. */
  async mergeProjects(fromProjectId: string, toProjectId: string, renameTo?: string) {
    return prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.project.findUnique({ where: { id: fromProjectId } }),
        tx.project.findUnique({ where: { id: toProjectId } })
      ]);
      if (!from || !to) throw new Error("One of the selected projects was not found");

      const [sourceFinancial, targetFinancial, sourceRequisition, targetRequisition, sourceDpr, targetDpr] =
        await Promise.all([
          tx.projectFinancialPlan.findUnique({ where: { projectId: fromProjectId }, select: { id: true } }),
          tx.projectFinancialPlan.findUnique({ where: { projectId: toProjectId }, select: { id: true } }),
          tx.projectRequisitionForm.findUnique({ where: { projectId: fromProjectId }, select: { id: true } }),
          tx.projectRequisitionForm.findUnique({ where: { projectId: toProjectId }, select: { id: true } }),
          tx.projectDprOverview.findUnique({ where: { projectId: fromProjectId }, select: { id: true } }),
          tx.projectDprOverview.findUnique({ where: { projectId: toProjectId }, select: { id: true } })
        ]);

      const conflicts = [
        sourceFinancial && targetFinancial ? "Financial plans" : null,
        sourceRequisition && targetRequisition ? "Project requisition forms" : null,
        sourceDpr && targetDpr ? "DPR overviews" : null
      ].filter(Boolean);
      if (conflicts.length) {
        throw new Error(`Cannot merge because both projects have ${conflicts.join(", ")}. Consolidate those records first.`);
      }

      const counts = await Promise.all([
        tx.projectAssignment.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.infraProjectOtherCost.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.projectRequisitionForm.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.projectFinancialPlan.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.projectDprOverview.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.expenseSheet.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.projectBillingEntry.updateMany({ where: { projectId: fromProjectId }, data: { projectId: toProjectId } }),
        tx.letterProject.updateMany({ where: { linkedProjectId: fromProjectId }, data: { linkedProjectId: toProjectId } }),
        tx.contractActivity.updateMany({ where: { linkedProjectId: fromProjectId }, data: { linkedProjectId: toProjectId } }),
        tx.subStaffAssignment.updateMany({
          where: {
            OR: [
              { projectId: fromProjectId },
              { projectId: null, siteName: { equals: from.name, mode: "insensitive" } }
            ]
          },
          data: { projectId: toProjectId, siteName: renameTo?.trim() || to.name }
        })
      ]);

      const projectPatch: Prisma.ProjectUpdateInput = {};
      if (!to.projectNumber && from.projectNumber) projectPatch.projectNumber = from.projectNumber;
      if (!to.description && from.description) projectPatch.description = from.description;
      if (!to.projectCodePrefix && from.projectCodePrefix) projectPatch.projectCodePrefix = from.projectCodePrefix;
      if (!to.companyCode && from.companyCode) projectPatch.companyCode = from.companyCode;
      if (!to.technicalUnitCode && from.technicalUnitCode) projectPatch.technicalUnitCode = from.technicalUnitCode;
      if (!to.subTechnicalUnitCode && from.subTechnicalUnitCode) projectPatch.subTechnicalUnitCode = from.subTechnicalUnitCode;
      if (!to.workCategoryCode && from.workCategoryCode) projectPatch.workCategoryCode = from.workCategoryCode;
      if (to.financialYearShort === null && from.financialYearShort !== null) projectPatch.financialYearShort = from.financialYearShort;
      if (to.serialNumber === null && from.serialNumber !== null) projectPatch.serialNumber = from.serialNumber;
      if (!to.projectNumberAssignedAt && from.projectNumberAssignedAt) projectPatch.projectNumberAssignedAt = from.projectNumberAssignedAt;
      for (const field of [
        "woAmount", "woGstAmount", "woTotalAmount", "excessAmount", "excessGstAmount", "excessTotalAmount",
        "bgAmount", "emdAmount"
      ] as const) {
        if (!to[field] && from[field]) projectPatch[field] = from[field];
      }
      if (!to.bgIssueDate && from.bgIssueDate) projectPatch.bgIssueDate = from.bgIssueDate;
      if (!to.bgExpiryDate && from.bgExpiryDate) projectPatch.bgExpiryDate = from.bgExpiryDate;
      if (!to.emdIssueDate && from.emdIssueDate) projectPatch.emdIssueDate = from.emdIssueDate;
      if (!to.emdExpiryDate && from.emdExpiryDate) projectPatch.emdExpiryDate = from.emdExpiryDate;
      if (renameTo?.trim()) projectPatch.name = renameTo.trim();
      if (Object.keys(projectPatch).length) {
        await tx.project.update({ where: { id: toProjectId }, data: projectPatch });
      }
      await tx.project.delete({ where: { id: fromProjectId } });

      return {
        updatedCount: counts.reduce((sum, result) => sum + result.count, 0),
        fromProjectName: from.name,
        toProjectName: renameTo?.trim() || to.name,
        duplicateDeleted: true
      };
    });
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
