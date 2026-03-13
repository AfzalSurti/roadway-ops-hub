import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

type ProjectRequisitionFormUpsertInput = Omit<Prisma.ProjectRequisitionFormCreateInput, "project"> & {
  projectId: string;
};

export const projectRequisitionFormRepository = {
  findMany() {
    return prisma.projectRequisitionForm.findMany({ orderBy: { createdAt: "desc" } });
  },
  findByProjectId(projectId: string) {
    return prisma.projectRequisitionForm.findUnique({ where: { projectId } });
  },
  upsert(projectId: string, data: ProjectRequisitionFormUpsertInput) {
    return prisma.projectRequisitionForm.upsert({
      where: { projectId },
      create: data,
      update: data
    });
  }
};