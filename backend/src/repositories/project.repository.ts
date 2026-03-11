import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const projectRepository = {
  findMany() {
    return prisma.project.findMany({ orderBy: { name: "asc" } });
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
  delete(id: string) {
    return prisma.project.delete({ where: { id } });
  }
};