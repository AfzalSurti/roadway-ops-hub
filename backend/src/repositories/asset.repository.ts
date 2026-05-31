import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

const ASSET_CLASS_GROUPS = {
  Appliances: [
    "Appliances - Air Conditioner",
    "Appliances - Air Cooler",
    "Appliances - Table Fan",
    "Appliances - Ceiling Fan",
    "Appliances - Cylinder",
    "Appliances - Gas Stove",
    "Appliances - Induction Cooktop",
    "Appliances - Oven",
    "Appliances - Invertor",
    "Appliances - Stabiliser",
    "Appliances - UPS",
    "Appliances - Kitchen Utensils",
    "Appliances - Refrigerator",
    "Appliances - TV",
    "Appliances - Set-up Box",
    "Appliances - Geyser",
    "Appliances - Heater",
    "Appliance - Electric Kettle",
    "Appliance - Water Purifier (RO)",
    "Applance- Washing machine"
  ],
  IT: [
    "IT - Computer (CPU / Monitor / KB / Mouse)",
    "IT - Laptop",
    "IT - Printer / Scanner",
    "IT - HDD",
    "IT - SSD",
    "IT - Pendrive",
    "IT - Wifi Router",
    "IT - Broadband",
    "IT - Dongle"
  ],
  Furniture: [
    "Chair - Office",
    "Chair - Revolving",
    "Chair - Visitor",
    "Chair - Guest",
    "Chair - Garden",
    "Chair - Plastic",
    "Chair - Wheel chair (Med)",
    "Cupboard",
    "Almirah",
    "Steel Rack",
    "Table - Dining (Plastic)",
    "Table - Office / Computer"
  ],
  Vehicles: ["Bike - Owned", "Car - Owned"],
  Misc: [
    "Misc - Box file",
    "Misc - Bucket / Mug / Bath Stool",
    "Misc - Bulb & Tubelights",
    "Misc - Calculator",
    "Misc - Curtains",
    "Misc - Door Mat",
    "Misc - Door Bell",
    "Misc - Dustbin",
    "Misc - Extension Board",
    "Misc - File Stand",
    "Misc - File tray",
    "Misc - Lock & Keys",
    "Misc - Measuring Tape",
    "Misc - Mirror",
    "Misc - Punching Machine",
    "Misc - Register",
    "Misc - Stamp",
    "Misc - Stapler",
    "Misc - Wall Clock",
    "Misc - Water Heating Rod",
    "Misc - Water Jug",
    "Misc - White Board",
    "Misc - Window Screen",
    "SF - Bed",
    "SF - Bed sheet",
    "SF - Blanket",
    "SF - Mattress",
    "SF - Pillow & Cover"
  ]
} as const;

function getAssetClassGroup(assetClass: string): string {
  for (const [group, items] of Object.entries(ASSET_CLASS_GROUPS)) {
    if ((items as readonly string[]).includes(assetClass)) {
      return group;
    }
  }
  return "Other";
}

function resolveAssetClassFilter(assetClass?: string): Prisma.AssetWhereInput | undefined {
  if (!assetClass) {
    return undefined;
  }

  if (assetClass in ASSET_CLASS_GROUPS) {
    return {
      OR: ASSET_CLASS_GROUPS[assetClass as keyof typeof ASSET_CLASS_GROUPS].map((value) => ({ assetClass: value }))
    };
  }

  return { assetClass };
}

export const assetRepository = {
  findMany(filters: { projectNumber?: string; assetClass?: string; status?: string; search?: string }, skip: number, take: number) {
    const exactFilters: Prisma.AssetWhereInput = {
      projectNumber: filters.projectNumber ?? undefined,
      status: filters.status as Prisma.AssetWhereInput["status"]
    };

    const andFilters: Prisma.AssetWhereInput[] = [];
    const assetClassFilter = resolveAssetClassFilter(filters.assetClass);
    if (assetClassFilter) {
      andFilters.push(assetClassFilter);
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      andFilters.push({
        OR: [
          { assetId: { contains: search } },
          { assetClass: { contains: search } },
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
    const assetClassFilter = resolveAssetClassFilter(filters.assetClass);
    if (assetClassFilter) {
      andFilters.push(assetClassFilter);
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      andFilters.push({
        OR: [
          { assetId: { contains: search } },
          { assetClass: { contains: search } },
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
