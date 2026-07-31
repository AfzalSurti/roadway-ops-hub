import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

type ListFilters = { workCategory?: string; client?: string; search?: string; tenderBidId?: string };

function buildWhere(filters: ListFilters): Prisma.PreContractActivityWhereInput {
  const where: Prisma.PreContractActivityWhereInput = {};
  if (filters.workCategory) where.workCategory = filters.workCategory;
  if (filters.client) where.client = filters.client;
  if (filters.tenderBidId) where.tenderBidId = filters.tenderBidId;
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    where.OR = [
      { nameOfWork: { contains: s, mode: "insensitive" } },
      { client: { contains: s, mode: "insensitive" } },
      { state: { contains: s, mode: "insensitive" } },
      { workCategory: { contains: s, mode: "insensitive" } }
    ];
  }
  return where;
}

export const operationsRepository = {
  findMany(filters: ListFilters, skip: number, take: number) {
    return prisma.preContractActivity.findMany({ where: buildWhere(filters), orderBy: { srNo: "asc" }, skip, take });
  },

  count(filters: ListFilters) {
    return prisma.preContractActivity.count({ where: buildWhere(filters) });
  },

  findById(id: string) {
    return prisma.preContractActivity.findUnique({ where: { id } });
  },

  findByTenderBidId(tenderBidId: string) {
    return prisma.preContractActivity.findUnique({ where: { tenderBidId } });
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

  async resequenceSrNos() {
    const items = await prisma.preContractActivity.findMany({ orderBy: { srNo: "asc" }, select: { id: true } });
    if (items.length === 0) return;
    await prisma.$transaction(
      items.map((item, index) =>
        prisma.preContractActivity.update({ where: { id: item.id }, data: { srNo: index + 1 } })
      )
    );
  },

  nextSrNo() {
    return prisma.preContractActivity.aggregate({ _max: { srNo: true } }).then((r) => (r._max.srNo ?? 0) + 1);
  }
};
