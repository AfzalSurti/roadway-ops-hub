import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const operationsRepository = {
  findMany(filters: { workCategory?: string; client?: string; search?: string }, skip: number, take: number) {
    const where: Prisma.PreContractActivityWhereInput = {};

    if (filters.workCategory) where.workCategory = filters.workCategory;
    if (filters.client) where.client = filters.client;

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { nameOfWork: { contains: s, mode: "insensitive" } },
        { client: { contains: s, mode: "insensitive" } },
        { state: { contains: s, mode: "insensitive" } },
        { workCategory: { contains: s, mode: "insensitive" } }
      ];
    }

    return prisma.preContractActivity.findMany({ where, orderBy: { srNo: "asc" }, skip, take });
  },

  count(filters: { workCategory?: string; client?: string; search?: string }) {
    const where: Prisma.PreContractActivityWhereInput = {};
    if (filters.workCategory) where.workCategory = filters.workCategory;
    if (filters.client) where.client = filters.client;
    if (filters.search?.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { nameOfWork: { contains: s, mode: "insensitive" } },
        { client: { contains: s, mode: "insensitive" } },
        { state: { contains: s, mode: "insensitive" } }
      ];
    }
    return prisma.preContractActivity.count({ where });
  },

  findById(id: string) {
    return prisma.preContractActivity.findUnique({ where: { id } });
  },

  create(data: Prisma.PreContractActivityCreateInput) {
    return prisma.preContractActivity.create({ data });
  },

  update(id: string, data: Prisma.PreContractActivityUpdateInput) {
    return prisma.preContractActivity.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.preContractActivity.delete({ where: { id } });
  },

  nextSrNo() {
    return prisma.preContractActivity.aggregate({ _max: { srNo: true } }).then((r) => (r._max.srNo ?? 0) + 1);
  }
};
