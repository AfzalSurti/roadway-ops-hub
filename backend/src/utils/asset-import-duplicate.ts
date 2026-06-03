import type { AssetStatus } from "@prisma/client";
import { IN_STORE_PROJECT_LABEL } from "../data/default-asset-catalog.js";

export type AssetImportFingerprintInput = {
  assetClass: string;
  assetType: string;
  markModel?: string | null;
  dateOfPurchase?: Date | string | null;
  warrantyPeriod?: string | null;
  purchaseAmount?: number;
  gst?: number;
  status?: AssetStatus;
  projectNumber?: string | null;
  projectName?: string | null;
  assignedUser?: string | null;
  assignedDate?: Date | string | null;
  itAssetId?: string | null;
  soldAmount?: number | null;
  soldRemark?: string | null;
};

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeDate(value?: Date | string | null): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function normalizeAmount(value?: number | null): string {
  return Number(value ?? 0).toFixed(2);
}

function resolveProjectFields(status: AssetStatus, projectNumber?: string | null, projectName?: string | null) {
  if (status === "IN_STORE") {
    return { projectNumber: IN_STORE_PROJECT_LABEL, projectName: IN_STORE_PROJECT_LABEL };
  }
  return {
    projectNumber: (projectNumber ?? "").trim(),
    projectName: (projectName ?? "").trim()
  };
}

export function buildAssetImportFingerprint(payload: AssetImportFingerprintInput): string {
  const status = payload.status ?? "IN_USE";
  const project = resolveProjectFields(status, payload.projectNumber, payload.projectName);

  return [
    normalizeText(payload.assetClass),
    normalizeText(payload.assetType),
    normalizeText(payload.markModel),
    normalizeDate(payload.dateOfPurchase),
    normalizeDate(payload.warrantyPeriod),
    normalizeAmount(payload.purchaseAmount),
    normalizeAmount(payload.gst),
    status,
    normalizeText(project.projectNumber),
    normalizeText(project.projectName),
    normalizeText(payload.assignedUser),
    normalizeDate(payload.assignedDate),
    normalizeText(payload.itAssetId),
    normalizeAmount(payload.soldAmount),
    normalizeText(payload.soldRemark)
  ].join("|");
}

export function normalizeItAssetId(value?: string | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalized.toLowerCase() : null;
}
