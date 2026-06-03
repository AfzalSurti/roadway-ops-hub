import type { AssetStatus, Prisma } from "@prisma/client";
import { IN_STORE_PROJECT_LABEL, SURVEY_EQUIPMENT_CLASS } from "../data/default-asset-catalog.js";
import { assetRepository } from "../repositories/asset.repository.js";
import { calculateAssetDepreciation } from "../utils/depreciation.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";

export const ASSET_ID_PREFIXES: Record<string, string> = {
  "Air Conditioner": "AC",
  "Air Cooler": "ACOOLR",
  "Table Fan": "TF",
  "Ceiling Fan": "CF",
  Cylinder: "CYL",
  "Gas Stove": "GS",
  "Induction Cooktop": "IND",
  Oven: "OVN",
  Invertor: "INV",
  Stabiliser: "STAB",
  UPS: "UPS",
  "Kitchen Utensils": "KU",
  Refrigerator: "REF",
  TV: "TV",
  "Set-up Box": "STB",
  Geyser: "GYS",
  Heater: "HTR",
  "Electric Kettle": "KTL",
  "Water Purifier (RO)": "RO",
  "Washing machine": "WM",
  "Bike - Owned": "BIKE",
  "Network Survey Vehicle": "NSV",
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
  "Computer (CPU / Monitor / KB / Mouse)": "CPU",
  Laptop: "LAP",
  "Printer / Scanner": "PRT",
  HDD: "HDD",
  SSD: "SSD",
  Pendrive: "PEN",
  "Wifi Router": "WIFI",
  Broadband: "BB",
  Dongle: "DNG",
  "Box file": "BF",
  "Bucket / Mug / Bath Stool": "BCK",
  "Bulb & Tubelights": "BLBT",
  Calculator: "CALC",
  Curtains: "CRT",
  "Door Mat": "DM",
  "Door Bell": "DB",
  Dustbin: "DST",
  "Extension Board": "EXT",
  "File Stand": "FST",
  "File tray": "FTY",
  "Lock & Keys": "LK",
  "Measuring Tape": "MT",
  Mirror: "MIR",
  "Punching Machine": "PM",
  Register: "REG",
  Stamp: "STP",
  Stapler: "STPL",
  "Wall Clock": "WCK",
  "Water Heating Rod": "WHR",
  "Water Jug": "WJ",
  "White Board": "WB",
  "Window Screen": "WS",
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

function enrichAsset<T extends { assetType: string; purchaseAmount: number; dateOfPurchase?: Date | null }>(
  asset: T
): T & ReturnType<typeof calculateAssetDepreciation> {
  return {
    ...asset,
    ...calculateAssetDepreciation(asset, new Date())
  };
}

function getAssetPrefix(assetType: string): string {
  const prefix = ASSET_ID_PREFIXES[assetType];
  if (!prefix) {
    return "OTR";
  }
  return prefix;
}

function toDateOnlyTime(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function validateWarrantyEndDate(dateOfPurchase?: Date | null, warrantyEndDate?: string | null): void {
  if (!warrantyEndDate) {
    return;
  }

  const parsedWarrantyEndDate = new Date(warrantyEndDate);
  if (Number.isNaN(parsedWarrantyEndDate.getTime())) {
    throw badRequest("Warranty end date must be a valid date");
  }

  if (dateOfPurchase && toDateOnlyTime(parsedWarrantyEndDate) < toDateOnlyTime(dateOfPurchase)) {
    throw badRequest("Warranty end date cannot be before the date of purchase");
  }
}

async function generateAssetId(assetType: string): Promise<string> {
  const prefix = getAssetPrefix(assetType);
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
    assetType: string;
    markModel?: string | null;
    dateOfPurchase?: Date | null;
    warrantyPeriod?: string | null;
    purchaseAmount?: number;
    gst?: number;
    projectNumber?: string | null;
    projectName?: string | null;
    assignedUser?: string | null;
    assignedDate?: Date | null;
    status?: AssetStatus;
    soldAmount?: number | null;
    soldRemark?: string | null;
    remarks?: string | null;
    forMonth?: string | null;
    itAssetId?: string | null;
  }) {
    validateWarrantyEndDate(payload.dateOfPurchase ?? null, payload.warrantyPeriod ?? null);

    const status = payload.status ?? "IN_USE";
    const projectNumber = status === "IN_STORE" ? IN_STORE_PROJECT_LABEL : payload.projectNumber ?? null;
    const projectName = status === "IN_STORE" ? IN_STORE_PROJECT_LABEL : payload.projectName ?? null;

    const assetId = await generateAssetId(payload.assetType);
    const purchaseAmount = payload.purchaseAmount ?? 0;
    const gst = payload.gst ?? 0;
    const depreciation = calculateAssetDepreciation(
      {
        assetType: payload.assetType,
        purchaseAmount,
        dateOfPurchase: payload.dateOfPurchase ?? null
      },
      payload.dateOfPurchase ?? new Date()
    );

    const created = await assetRepository.create({
      assetId,
      itAssetId: payload.itAssetId ?? null,
      assetClass: payload.assetClass,
      assetType: payload.assetType,
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
      projectNumber,
      projectName,
      assignedUser: status === "IN_STORE" ? null : payload.assignedUser ?? null,
      assignedDate: payload.assignedDate ?? payload.dateOfPurchase ?? new Date(),
      status,
      soldAmount: payload.soldAmount ?? 0,
      soldRemark: payload.soldRemark ?? null,
      remarks: payload.remarks ?? null,
      forMonth: payload.forMonth ?? null
    });

    return enrichAsset(created);
  },

  async update(
    id: string,
    payload: {
      assetClass?: string;
      assetType?: string;
      markModel?: string | null;
      dateOfPurchase?: Date | null;
      warrantyPeriod?: string | null;
      purchaseAmount?: number;
      gst?: number;
      projectNumber?: string | null;
      projectName?: string | null;
      assignedUser?: string | null;
      assignedDate?: Date | null;
      status?: AssetStatus;
      soldAmount?: number | null;
      soldRemark?: string | null;
      remarks?: string | null;
      forMonth?: string | null;
      itAssetId?: string | null;
    }
  ) {
    const existing = await this.getById(id);
    const shouldValidateWarranty = Object.prototype.hasOwnProperty.call(payload, "warrantyPeriod");
    if (shouldValidateWarranty) {
      validateWarrantyEndDate(
        payload.dateOfPurchase ?? existing.dateOfPurchase ?? null,
        payload.warrantyPeriod ?? null
      );
    }

    const nextPurchaseAmount = payload.purchaseAmount ?? existing.purchaseAmount;
    const nextGst = payload.gst ?? existing.gst;
    const nextAssetType = payload.assetType ?? existing.assetType;
    const depreciation = calculateAssetDepreciation(
      {
        assetType: nextAssetType,
        purchaseAmount: nextPurchaseAmount,
        dateOfPurchase: payload.dateOfPurchase ?? existing.dateOfPurchase ?? null
      },
      payload.dateOfPurchase ?? existing.dateOfPurchase ?? new Date()
    );

    const data: Prisma.AssetUncheckedUpdateInput = {
      ...payload,
      soldAmount: payload.soldAmount ?? undefined,
      soldRemark: payload.soldRemark ?? undefined,
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
      movedToProjectName?: string | null;
      dateOfMoving: Date;
      movedToUser?: string | null;
      moveToStore?: boolean;
    }
  ) {
    const asset = await this.getById(assetId);
    if (asset.status === "DISPOSED") {
      throw badRequest("Sold assets cannot have movement entries");
    }

    const isSurveyEquipment = asset.assetClass === SURVEY_EQUIPMENT_CLASS;
    const moveToStore = Boolean(payload.moveToStore);

    if (moveToStore) {
      if (!isSurveyEquipment) {
        throw badRequest("Only Survey Equipment can be moved to store");
      }
      if (asset.status !== "IN_USE") {
        throw badRequest("Only in-use assets can be moved to store");
      }
    } else if (asset.status === "IN_STORE" && !isSurveyEquipment) {
      throw badRequest("This asset must be assigned from store using Survey Equipment workflow");
    }

    const latestOpenMovement = await assetRepository.findLatestOpenMovement(assetId);
    if (latestOpenMovement) {
      await assetRepository.updateMovement(latestOpenMovement.id, { returnDate: payload.dateOfMoving });
    }

    const previousProjectNumber = asset.projectNumber ?? null;
    const previousProjectName = asset.projectName ?? null;
    const previousAssignedDate = latestOpenMovement?.assignedDate ?? asset.assignedDate ?? asset.dateOfPurchase ?? asset.createdAt;
    const previousUser = asset.assignedUser ?? null;

    const nextProjectNumber = moveToStore ? IN_STORE_PROJECT_LABEL : payload.movedToProjectNumber?.trim() ?? null;
    const nextProjectName = moveToStore ? IN_STORE_PROJECT_LABEL : payload.movedToProjectName?.trim() ?? null;
    const nextUser = moveToStore ? null : payload.movedToUser?.trim() ?? null;
    const nextStatus: AssetStatus = moveToStore ? "IN_STORE" : "IN_USE";

    const movement = await assetRepository.addMovement(assetId, {
      assetId,
      previousProjectNumber,
      previousProjectName,
      previousAssignedDate,
      previousUser,
      movedToProjectNumber: nextProjectNumber,
      movedToProjectName: nextProjectName,
      assignedDate: payload.dateOfMoving,
      dateOfMoving: payload.dateOfMoving,
      movedToUser: nextUser
    });

    await assetRepository.update(assetId, {
      projectNumber: nextProjectNumber,
      projectName: nextProjectName,
      assignedUser: nextUser,
      assignedDate: payload.dateOfMoving,
      status: nextStatus
    });

    return movement;
  },

  async addMaintenance(
    assetId: string,
    payload: {
      dateOfMaintenance: Date;
      repairCostInclGst?: number;
      remark?: string | null;
    }
  ) {
    const asset = await this.getById(assetId);
    if (asset.status === "DISPOSED") {
      throw badRequest("Sold assets cannot have maintenance entries");
    }
    const depreciation = calculateAssetDepreciation(
      {
        assetType: asset.assetType,
        purchaseAmount: asset.purchaseAmount,
        dateOfPurchase: asset.dateOfPurchase ?? null
      },
      payload.dateOfMaintenance
    );

    const maintenanceProjectNumber =
      asset.status === "IN_STORE" ? IN_STORE_PROJECT_LABEL : asset.projectNumber ?? null;
    const maintenanceProjectName =
      asset.status === "IN_STORE" ? IN_STORE_PROJECT_LABEL : asset.projectName ?? null;

    return assetRepository.addMaintenance(assetId, {
      ...payload,
      depreciationTillDate: depreciation.currentValue,
      projectNumber: maintenanceProjectNumber,
      projectName: maintenanceProjectName,
      remark: payload.remark ?? null,
      assetId
    });
  },

  async getStats() {
    return assetRepository.getStats();
  }
};
