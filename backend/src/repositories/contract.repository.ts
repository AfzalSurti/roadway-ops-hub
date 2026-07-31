import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

type ListFilters = { workCategory?: string; client?: string; search?: string; tenderBidId?: string };

function buildWhere(filters: ListFilters): Prisma.ContractActivityWhereInput {
  const where: Prisma.ContractActivityWhereInput = {};
  if (filters.workCategory) where.workCategory = filters.workCategory;
  if (filters.client) where.client = filters.client;
  if (filters.tenderBidId) where.tenderBidId = filters.tenderBidId;
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    where.OR = [
      { nameOfWork: { contains: s, mode: "insensitive" } },
      { nameOfBidder: { contains: s, mode: "insensitive" } },
      { bidInvitingAuthority: { contains: s, mode: "insensitive" } },
      { client: { contains: s, mode: "insensitive" } },
      { state: { contains: s, mode: "insensitive" } },
      { workCategory: { contains: s, mode: "insensitive" } }
    ];
  }
  return where;
}

export const contractRepository = {
  findMany(filters: ListFilters, skip: number, take: number) {
    return prisma.contractActivity.findMany({ where: buildWhere(filters), orderBy: { srNo: "asc" }, skip, take });
  },

  count(filters: ListFilters) {
    return prisma.contractActivity.count({ where: buildWhere(filters) });
  },

  findById(id: string) {
    return prisma.contractActivity.findUnique({ where: { id } });
  },

  findByTenderBidId(tenderBidId: string) {
    return prisma.contractActivity.findUnique({ where: { tenderBidId } });
  },

  create(data: Prisma.ContractActivityCreateInput) {
    return prisma.contractActivity.create({ data });
  },

  update(id: string, data: Prisma.ContractActivityUpdateInput) {
    return prisma.contractActivity.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.contractActivity.delete({ where: { id } });
  },

  async resequenceSrNos() {
    const items = await prisma.contractActivity.findMany({ orderBy: { srNo: "asc" }, select: { id: true } });
    if (items.length === 0) return;
    await prisma.$transaction(
      items.map((item, index) =>
        prisma.contractActivity.update({ where: { id: item.id }, data: { srNo: index + 1 } })
      )
    );
  },

  nextSrNo() {
    return prisma.contractActivity.aggregate({ _max: { srNo: true } }).then((r) => (r._max.srNo ?? 0) + 1);
  }
};
