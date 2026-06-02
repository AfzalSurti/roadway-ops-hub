import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

function getAssetClassGroup(assetClass: string): string {
  return assetClass || "Other";
}

export const assetRepository = {
  findMany(filters: { projectNumber?: string; assetClass?: string; status?: string; search?: string }, skip: number, take: number) {
    const exactFilters: Prisma.AssetWhereInput = {
      projectNumber: filters.projectNumber ?? undefined,
      status: filters.status as Prisma.AssetWhereInput["status"]
    };

    const andFilters: Prisma.AssetWhereInput[] = [];
    if (filters.assetClass) {
      andFilters.push({ assetClass: filters.assetClass });
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      andFilters.push({
        OR: [
          { assetId: { contains: search } },
          { assetClass: { contains: search } },
          { assetType: { contains: search } },
          { markModel: { contains: search } },
          { itAssetId: { contains: search } }
        ]
      });
    }

    return prisma.asset.findMany({
      where: andFilters.length ? { AND: [exactFilters, ...andFilters] } : exactFilters,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
      include: {
        movements: { orderBy: { dateOfMoving: "desc" } },
        maintenances: { orderBy: { dateOfMaintenance: "desc" } }
      }
    });
  },

  count(filters: { projectNumber?: string; assetClass?: string; status?: string; search?: string }) {
    const exactFilters: Prisma.AssetWhereInput = {
      projectNumber: filters.projectNumber ?? undefined,
      status: filters.status as Prisma.AssetWhereInput["status"]
    };

    const andFilters: Prisma.AssetWhereInput[] = [];
    if (filters.assetClass) {
      andFilters.push({ assetClass: filters.assetClass });
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      andFilters.push({
        OR: [
          { assetId: { contains: search } },
          { assetClass: { contains: search } },
          { assetType: { contains: search } },
          { markModel: { contains: search } },
          { itAssetId: { contains: search } }
        ]
      });
    }

    return prisma.asset.count({ where: andFilters.length ? { AND: [exactFilters, ...andFilters] } : exactFilters });
  },

  countByAssetIdPrefix(prefix: string) {
    return prisma.asset.count({ where: { assetId: { startsWith: `${prefix}-` } } });
  },

  findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { dateOfMoving: "desc" } },
        maintenances: { orderBy: { dateOfMaintenance: "desc" } }
      }
    });
  },

  create(data: Prisma.AssetCreateInput) {
    return prisma.asset.create({ data, include: { movements: true, maintenances: true } });
  },

  update(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return prisma.asset.update({ where: { id }, data, include: { movements: true, maintenances: true } });
  },

  delete(id: string) {
    return prisma.asset.delete({ where: { id } });
  },

  addMovement(assetId: string, data: Prisma.AssetMovementUncheckedCreateInput) {
    return prisma.assetMovement.create({ data: { ...data, assetId } });
  },

  findLatestOpenMovement(assetId: string) {
    return prisma.assetMovement.findFirst({
      where: { assetId, returnDate: null },
      orderBy: { assignedDate: "desc" }
    });
  },

  updateMovement(id: string, data: Prisma.AssetMovementUncheckedUpdateInput) {
    return prisma.assetMovement.update({ where: { id }, data });
  },

  addMaintenance(assetId: string, data: Prisma.AssetMaintenanceUncheckedCreateInput) {
    return prisma.assetMaintenance.create({ data: { ...data, assetId } });
  },

  async getStats() {
    const [statusCounts, assetClassCounts, totalValueRow, totalAssets, projectNumberCount] = await Promise.all([
      prisma.asset.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.asset.groupBy({ by: ["assetClass"], _count: { assetClass: true } }),
      prisma.asset.aggregate({ _sum: { totalAmountWithGst: true } }),
      prisma.asset.count(),
      prisma.asset.groupBy({ by: ["projectNumber"], where: { projectNumber: { not: null } }, _count: { projectNumber: true } })
    ]);

    return {
      totalAssets,
      totalAssetValue: totalValueRow._sum.totalAmountWithGst ?? 0,
      projectsWithAssets: projectNumberCount.length,
      assetsWithProjectNumber: projectNumberCount.length,
      statusCounts: statusCounts.reduce<Record<string, number>>((accumulator, item) => {
        accumulator[item.status] = item._count.status;
        return accumulator;
      }, {}),
      assetClassCounts: assetClassCounts.reduce<Record<string, { count: number; group: string }>>((accumulator, item) => {
        accumulator[item.assetClass] = { count: item._count.assetClass, group: getAssetClassGroup(item.assetClass) };
        return accumulator;
      }, {})
    };
  }
};
