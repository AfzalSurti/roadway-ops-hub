import type { AssetStatus, Prisma } from "@prisma/client";
import { assetRepository } from "../repositories/asset.repository.js";
import { calculateAssetDepreciation } from "../utils/depreciation.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";

export const ASSET_ID_PREFIXES: Record<string, string> = {
  "Appliances - Air Conditioner": "AC",
  "Appliances - Air Cooler": "ACOOLR",
  "Appliances - Table Fan": "TF",
  "Appliances - Ceiling Fan": "CF",
  "Appliances - Cylinder": "CYL",
  "Appliances - Gas Stove": "GS",
  "Appliances - Induction Cooktop": "IND",
  "Appliances - Oven": "OVN",
  "Appliances - Invertor": "INV",
  "Appliances - Stabiliser": "STAB",
  "Appliances - UPS": "UPS",
  "Appliances - Kitchen Utensils": "KU",
  "Appliances - Refrigerator": "REF",
  "Appliances - TV": "TV",
  "Appliances - Set-up Box": "STB",
  "Appliances - Geyser": "GYS",
  "Appliances - Heater": "HTR",
  "Appliance - Electric Kettle": "KTL",
  "Appliance - Water Purifier (RO)": "RO",
  "Applance- Washing machine": "WM",
  "Bike - Owned": "BIKE",
  "Car - Owned": "CAR",
  "Chair - Office": "CHR-O",
  "Chair - Revolving": "CHR-R",
  "Chair - Visitor": "CHR-V",
  "Chair - Guest": "CHR-G",
  "Chair - Garden": "CHR-GD",
  "Chair - Plastic": "CHR-P",
  "Chair - Wheel chair (Med)": "WCH",
  Cupboard: "CPB",
  Almirah: "ALM",
  "Steel Rack": "RACK",
  "IT - Computer (CPU / Monitor / KB / Mouse)": "CPU",
  "IT - Laptop": "LAP",
  "IT - Printer / Scanner": "PRT",
  "IT - HDD": "HDD",
  "IT - SSD": "SSD",
  "IT - Pendrive": "PEN",
  "IT - Wifi Router": "WIFI",
  "IT - Broadband": "BB",
  "IT - Dongle": "DNG",
  "Misc - Box file": "BF",
  "Misc - Bucket / Mug / Bath Stool": "BCK",
  "Misc - Bulb & Tubelights": "BLBT",
  "Misc - Calculator": "CALC",
  "Misc - Curtains": "CRT",
  "Misc - Door Mat": "DM",
  "Misc - Door Bell": "DB",
  "Misc - Dustbin": "DST",
  "Misc - Extension Board": "EXT",
  "Misc - File Stand": "FST",
  "Misc - File tray": "FTY",
  "Misc - Lock & Keys": "LK",
  "Misc - Measuring Tape": "MT",
  "Misc - Mirror": "MIR",
  "Misc - Punching Machine": "PM",
  "Misc - Register": "REG",
  "Misc - Stamp": "STP",
  "Misc - Stapler": "STPL",
  "Misc - Wall Clock": "WCK",
  "Misc - Water Heating Rod": "WHR",
  "Misc - Water Jug": "WJ",
  "Misc - White Board": "WB",
  "Misc - Window Screen": "WS",
  "SF - Bed": "BED",
  "SF - Bed sheet": "BDSH",
  "SF - Blanket": "BLK",
  "SF - Mattress": "MAT",
  "SF - Pillow & Cover": "PIL",
  "Table - Dining (Plastic)": "TBL-D",
  "Table - Office / Computer": "TBL-O"
};

type AssetFilters = {
  projectNumber?: string;
  assetClass?: string;
  status?: AssetStatus;
  search?: string;
};

function calculateTotalAmountWithGst(purchaseAmount: number, gst: number): number {
  return Number((purchaseAmount + gst).toFixed(2));
}

function enrichAsset<T extends { assetClass: string; purchaseAmount: number; dateOfPurchase?: Date | null }>(asset: T) {
  return {
    ...asset,
    ...calculateAssetDepreciation(asset, new Date())
  };
}

function getAssetPrefix(assetClass: string): string {
  const prefix = ASSET_ID_PREFIXES[assetClass];
  if (!prefix) {
    throw badRequest("Invalid asset class");
  }
  return prefix;
}

async function generateAssetId(assetClass: string): Promise<string> {
  const prefix = getAssetPrefix(assetClass);
  const existingCount = await assetRepository.countByAssetIdPrefix(prefix);
  return `${prefix}-${existingCount + 1}`;
}

export const assetService = {
  async list(filters: AssetFilters, page?: number, limit?: number) {
    const pagination = getPagination({ page, limit });
    const [items, total] = await Promise.all([
      assetRepository.findMany(filters, pagination.skip, pagination.limit),
      assetRepository.count(filters)
    ]);

    return {
      items: items.map((item) => enrichAsset(item)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  },

  async getById(id: string) {
    const asset = await assetRepository.findById(id);
    if (!asset) {
      throw notFound("Asset not found");
    }
    return enrichAsset(asset);
  },

  async create(payload: {
    assetClass: string;
    markModel?: string | null;
    dateOfPurchase?: Date | null;
    warrantyPeriod?: string | null;
    purchaseAmount?: number;
    gst?: number;
    projectNumber?: string | null;
    assignedUser?: string | null;
    status?: AssetStatus;
    remarks?: string | null;
    forMonth?: string | null;
    itAssetId?: string | null;
  }) {
    const assetId = await generateAssetId(payload.assetClass);
    const purchaseAmount = payload.purchaseAmount ?? 0;
    const gst = payload.gst ?? 0;
    const depreciation = calculateAssetDepreciation(
      {
        assetClass: payload.assetClass,
        purchaseAmount,
        dateOfPurchase: payload.dateOfPurchase ?? null
      },
      payload.dateOfPurchase ?? new Date()
    );

    const created = await assetRepository.create({
      assetId,
      itAssetId: payload.itAssetId ?? null,
      assetClass: payload.assetClass,
      markModel: payload.markModel ?? null,
      dateOfPurchase: payload.dateOfPurchase ?? null,
      warrantyPeriod: payload.warrantyPeriod ?? null,
      purchaseAmount,
      gst,
      totalAmountWithGst: calculateTotalAmountWithGst(purchaseAmount, gst),
      usefulLifeYears: depreciation.usefulLifeYears,
      scrapRate: depreciation.scrapRate,
      scrapValue: depreciation.scrapValue,
      depreciationPerYear: depreciation.depreciationPerYear,
      projectNumber: payload.projectNumber ?? null,
      assignedUser: payload.assignedUser ?? null,
      status: payload.status ?? "IN_USE",
      remarks: payload.remarks ?? null,
      forMonth: payload.forMonth ?? null
    });

    return enrichAsset(created);
  },

  async update(
    id: string,
    payload: {
      assetClass?: string;
      markModel?: string | null;
      dateOfPurchase?: Date | null;
      warrantyPeriod?: string | null;
      purchaseAmount?: number;
      gst?: number;
      projectNumber?: string | null;
      assignedUser?: string | null;
      status?: AssetStatus;
      remarks?: string | null;
      forMonth?: string | null;
      itAssetId?: string | null;
    }
  ) {
    const existing = await this.getById(id);
    const nextPurchaseAmount = payload.purchaseAmount ?? existing.purchaseAmount;
    const nextGst = payload.gst ?? existing.gst;
    const nextAssetClass = payload.assetClass ?? existing.assetClass;
    const depreciation = calculateAssetDepreciation(
      {
        assetClass: nextAssetClass,
        purchaseAmount: nextPurchaseAmount,
        dateOfPurchase: payload.dateOfPurchase ?? existing.dateOfPurchase ?? null
      },
      payload.dateOfPurchase ?? existing.dateOfPurchase ?? new Date()
    );

    const data: Prisma.AssetUncheckedUpdateInput = {
      ...payload,
      totalAmountWithGst: calculateTotalAmountWithGst(nextPurchaseAmount, nextGst),
      usefulLifeYears: depreciation.usefulLifeYears,
      scrapRate: depreciation.scrapRate,
      scrapValue: depreciation.scrapValue,
      depreciationPerYear: depreciation.depreciationPerYear
    };

    const updated = await assetRepository.update(id, data);
    return enrichAsset(updated);
  },

  async remove(id: string) {
    await this.getById(id);
    await assetRepository.delete(id);
    return { deleted: true };
  },

  async addMovement(
    assetId: string,
    payload: {
      movedToProjectNumber?: string | null;
      dateOfMoving: Date;
      movedToUser?: string | null;
    }
  ) {
    const asset = await this.getById(assetId);
    if (asset.status === "DISPOSED") {
      throw badRequest("Sold assets cannot have movement entries");
    }
    return assetRepository.addMovement(assetId, { ...payload, assetId });
  },

  async addMaintenance(
    assetId: string,
    payload: {
      dateOfMaintenance: Date;
      repairCostInclGst?: number;
      sellAmount?: number;
      soldTo?: string | null;
      remark?: string | null;
    }
  ) {
    const asset = await this.getById(assetId);
    if (asset.status === "DISPOSED") {
      throw badRequest("Sold assets cannot have maintenance entries");
    }
    const depreciation = calculateAssetDepreciation(
      {
        assetClass: asset.assetClass,
        purchaseAmount: asset.purchaseAmount,
        dateOfPurchase: asset.dateOfPurchase ?? null
      },
      payload.dateOfMaintenance
    );

    return assetRepository.addMaintenance(assetId, {
      ...payload,
      depreciationTillDate: depreciation.currentValue,
      soldTo: payload.sellAmount && payload.sellAmount > 0 ? payload.soldTo ?? null : null,
      remark: payload.remark ?? null,
      assetId
    }).then(async (maintenance) => {
      if ((payload.sellAmount ?? 0) > 0) {
        await assetRepository.update(assetId, { status: "DISPOSED" });
      }

      return maintenance;
    });
  },

  async getStats() {
    return assetRepository.getStats();
  }
};
