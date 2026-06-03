import type { AssetItem, AssetStatus } from "./domain";
import { IN_STORE_PROJECT_LABEL } from "@/hooks/useAssetCatalog";
import type { AssetImportRowPayload } from "./asset-import";

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeDate(value?: string | null): string {
  if (!value) return "";
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : "";
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

export function buildAssetImportFingerprint(payload: AssetImportRowPayload): string {
  const project = resolveProjectFields(payload.status, payload.projectNumber, payload.projectName);

  return [
    normalizeText(payload.assetClass),
    normalizeText(payload.assetType),
    normalizeText(payload.markModel),
    normalizeDate(payload.dateOfPurchase),
    normalizeDate(payload.warrantyPeriod),
    normalizeAmount(payload.purchaseAmount),
    normalizeAmount(payload.gst),
    payload.status,
    normalizeText(project.projectNumber),
    normalizeText(project.projectName),
    normalizeText(payload.assignedUser),
    normalizeDate(payload.assignedDate),
    normalizeText(payload.itAssetId),
    normalizeAmount(payload.soldAmount),
    normalizeText(payload.soldRemark)
  ].join("|");
}

export function buildAssetImportFingerprintFromAsset(asset: AssetItem): string {
  return buildAssetImportFingerprint({
    assetClass: asset.assetClass,
    assetType: asset.assetType,
    markModel: asset.markModel,
    dateOfPurchase: asset.dateOfPurchase,
    warrantyPeriod: asset.warrantyPeriod,
    purchaseAmount: asset.purchaseAmount,
    gst: asset.gst,
    status: asset.status,
    projectNumber: asset.projectNumber,
    projectName: asset.projectName,
    assignedUser: asset.assignedUser,
    assignedDate: asset.assignedDate,
    itAssetId: asset.itAssetId,
    soldAmount: asset.soldAmount,
    soldRemark: asset.soldRemark
  });
}

export function normalizeItAssetId(value?: string | null): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalized.toLowerCase() : null;
}

export function findImportDuplicates(
  rows: Array<{ excelRow: number; payload: AssetImportRowPayload }>,
  existingAssets: AssetItem[]
): Array<{ excelRow: number; message: string }> {
  const errors: Array<{ excelRow: number; message: string }> = [];
  const existingByFingerprint = new Map<string, string>();
  const existingByItAssetId = new Map<string, string>();

  for (const asset of existingAssets) {
    existingByFingerprint.set(buildAssetImportFingerprintFromAsset(asset), asset.assetId);
    const itAssetId = normalizeItAssetId(asset.itAssetId);
    if (itAssetId) {
      existingByItAssetId.set(itAssetId, asset.assetId);
    }
  }

  const batchFingerprints = new Map<string, number>();
  const batchItAssetIds = new Map<string, number>();

  for (const row of rows) {
    const fingerprint = buildAssetImportFingerprint(row.payload);
    const existingAssetId = existingByFingerprint.get(fingerprint);
    if (existingAssetId) {
      errors.push({
        excelRow: row.excelRow,
        message: `This asset is not allowed because it already exists (matches ${existingAssetId})`
      });
      continue;
    }

    const duplicateBatchRow = batchFingerprints.get(fingerprint);
    if (duplicateBatchRow !== undefined) {
      errors.push({
        excelRow: row.excelRow,
        message: `This asset is not allowed because it is a duplicate of row ${duplicateBatchRow} in this Excel file`
      });
      continue;
    }

    const itAssetId = normalizeItAssetId(row.payload.itAssetId);
    if (itAssetId) {
      const existingByIt = existingByItAssetId.get(itAssetId);
      if (existingByIt) {
        errors.push({
          excelRow: row.excelRow,
          message: `This asset is not allowed because IT Asset ID already exists (matches ${existingByIt})`
        });
        continue;
      }
      const duplicateItRow = batchItAssetIds.get(itAssetId);
      if (duplicateItRow !== undefined) {
        errors.push({
          excelRow: row.excelRow,
          message: `This asset is not allowed because IT Asset ID is duplicated in row ${duplicateItRow} of this Excel file`
        });
        continue;
      }
      batchItAssetIds.set(itAssetId, row.excelRow);
    }

    batchFingerprints.set(fingerprint, row.excelRow);
  }

  return errors;
}
