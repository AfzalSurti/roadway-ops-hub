import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const tenderRepository = {
  findMany(filters: { workCategory?: string; client?: string; status?: string; search?: string }, skip: number, take: number) {
    const where: Prisma.TenderBidWhereInput = {};

    if (filters.workCategory) where.workCategory = filters.workCategory;
    if (filters.client) where.client = filters.client;
    if (filters.status) where.status = filters.status as Prisma.TenderBidWhereInput["status"];

    if (filters.search?.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { nameOfWork: { contains: s, mode: "insensitive" } },
        { client: { contains: s, mode: "insensitive" } },
        { state: { contains: s, mode: "insensitive" } },
        { workCategory: { contains: s, mode: "insensitive" } }
      ];
    }

    return prisma.tenderBid.findMany({ where, orderBy: { srNo: "asc" }, skip, take });
  },

  count(filters: { workCategory?: string; client?: string; status?: string; search?: string }) {
    const where: Prisma.TenderBidWhereInput = {};
    if (filters.workCategory) where.workCategory = filters.workCategory;
    if (filters.client) where.client = filters.client;
    if (filters.status) where.status = filters.status as Prisma.TenderBidWhereInput["status"];
    if (filters.search?.trim()) {
      const s = filters.search.trim();
      where.OR = [
        { nameOfWork: { contains: s, mode: "insensitive" } },
        { client: { contains: s, mode: "insensitive" } },
        { state: { contains: s, mode: "insensitive" } }
      ];
    }
    return prisma.tenderBid.count({ where });
  },

  findById(id: string) {
    return prisma.tenderBid.findUnique({ where: { id } });
  },

  create(data: Prisma.TenderBidCreateInput) {
    return prisma.tenderBid.create({ data });
  },

  update(id: string, data: Prisma.TenderBidUpdateInput) {
    return prisma.tenderBid.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.tenderBid.delete({ where: { id } });
  },

  async resequenceSrNos() {
    const items = await prisma.tenderBid.findMany({ orderBy: { srNo: "asc" }, select: { id: true } });
    if (items.length === 0) return;
    await prisma.$transaction(
      items.map((item, index) =>
        prisma.tenderBid.update({ where: { id: item.id }, data: { srNo: index + 1 } })
      )
    );
  },

  nextSrNo() {
    return prisma.tenderBid.aggregate({ _max: { srNo: true } }).then((r) => (r._max.srNo ?? 0) + 1);
  }
};
