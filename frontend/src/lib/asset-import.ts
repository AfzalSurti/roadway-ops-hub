import * as XLSX from "xlsx";
import type { AssetStatus } from "./domain";

export const ASSET_IMPORT_HEADERS = [
  "Asset Class*",
  "Asset Type*",
  "Mark / Model",
  "Date of Purchase",
  "Warranty End Date",
  "Purchase Amount",
  "GST",
  "Status*",
  "Project Number",
  "Project Name",
  "Assigned User",
  "Assigned Date",
  "IT Asset ID",
  "Remarks",
  "For Month",
  "Sold Amount",
  "Sold Remark"
] as const;

export type AssetImportRowPayload = {
  assetClass: string;
  assetType: string;
  markModel?: string | null;
  dateOfPurchase?: string | null;
  warrantyPeriod?: string | null;
  purchaseAmount: number;
  gst: number;
  status: AssetStatus;
  projectNumber?: string | null;
  projectName?: string | null;
  assignedUser?: string | null;
  assignedDate?: string | null;
  itAssetId?: string | null;
  remarks?: string | null;
  forMonth?: string | null;
  soldAmount?: number | null;
  soldRemark?: string | null;
};

export type ParsedAssetImportRow = {
  excelRow: number;
  payload: AssetImportRowPayload;
};

export type AssetImportParseIssue = {
  excelRow: number;
  message: string;
};

const HEADER_ALIASES: Record<string, keyof AssetImportRowPayload | "ignore"> = {
  "asset class*": "assetClass",
  "asset class": "assetClass",
  "asset type*": "assetType",
  "asset type": "assetType",
  "mark / model": "markModel",
  "mark/model": "markModel",
  "date of purchase": "dateOfPurchase",
  "warranty end date": "warrantyPeriod",
  "purchase amount": "purchaseAmount",
  gst: "gst",
  "status*": "status",
  status: "status",
  "project number": "projectNumber",
  "project name": "projectName",
  "assigned user": "assignedUser",
  "assigned date": "assignedDate",
  "it asset id": "itAssetId",
  remarks: "remarks",
  "for month": "forMonth",
  "sold amount": "soldAmount",
  "sold remark": "soldRemark"
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function parseNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numeric = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function parseStatus(value: unknown): AssetStatus | null {
  const text = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!text) {
    return null;
  }
  if (text === "SOLD") {
    return "DISPOSED";
  }
  if (text === "IN_USE" || text === "IN_STORE" || text === "UNDER_REPAIR" || text === "DISPOSED") {
    return text;
  }
  return null;
}

function rowIsEmpty(values: Record<string, unknown>): boolean {
  const keys: Array<keyof AssetImportRowPayload> = ["assetClass", "assetType", "markModel", "projectNumber"];
  return keys.every((key) => !String(values[key] ?? "").trim());
}

function mapRawRow(values: Record<string, unknown>): { payload?: AssetImportRowPayload; error?: string } {
  const assetClass = String(values.assetClass ?? "").trim();
  const assetType = String(values.assetType ?? "").trim();
  if (!assetClass) {
    return { error: "Asset Class is required" };
  }
  if (!assetType) {
    return { error: "Asset Type is required" };
  }

  const status = parseStatus(values.status);
  if (!status) {
    return { error: "Status must be IN_USE, IN_STORE, UNDER_REPAIR, SOLD, or DISPOSED" };
  }

  const purchaseAmount = parseNumber(values.purchaseAmount, 0);
  const gst = parseNumber(values.gst, 0);
  if (Number.isNaN(purchaseAmount) || purchaseAmount < 0) {
    return { error: "Purchase Amount must be a valid number >= 0" };
  }
  if (Number.isNaN(gst) || gst < 0) {
    return { error: "GST must be a valid number >= 0" };
  }

  const dateOfPurchase = parseExcelDate(values.dateOfPurchase);
  if (values.dateOfPurchase && !dateOfPurchase) {
    return { error: "Date of Purchase is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const warrantyPeriod = parseExcelDate(values.warrantyPeriod);
  if (values.warrantyPeriod && !warrantyPeriod) {
    return { error: "Warranty End Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const assignedDate = parseExcelDate(values.assignedDate);
  if (values.assignedDate && !assignedDate) {
    return { error: "Assigned Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const projectNumber = String(values.projectNumber ?? "").trim();
  const projectName = String(values.projectName ?? "").trim();
  if (status === "IN_USE" && !projectNumber) {
    return { error: "Project Number is required when Status is IN_USE" };
  }

  let soldAmount: number | null = null;
  if (values.soldAmount !== undefined && values.soldAmount !== null && String(values.soldAmount).trim() !== "") {
    soldAmount = parseNumber(values.soldAmount, 0);
    if (Number.isNaN(soldAmount) || soldAmount < 0) {
      return { error: "Sold Amount must be a valid number >= 0" };
    }
  }

  const soldRemark = String(values.soldRemark ?? "").trim();
  if (status === "DISPOSED" && soldAmount !== null && soldAmount > 0 && !soldRemark) {
    return { error: "Sold Remark is required when Sold Amount is provided for SOLD assets" };
  }

  return {
    payload: {
      assetClass,
      assetType,
      markModel: String(values.markModel ?? "").trim() || null,
      dateOfPurchase,
      warrantyPeriod,
      purchaseAmount,
      gst,
      status,
      projectNumber: projectNumber || null,
      projectName: projectName || null,
      assignedUser: String(values.assignedUser ?? "").trim() || null,
      assignedDate,
      itAssetId: String(values.itAssetId ?? "").trim() || null,
      remarks: String(values.remarks ?? "").trim() || null,
      forMonth: String(values.forMonth ?? "").trim() || null,
      soldAmount,
      soldRemark: soldRemark || null
    }
  };
}

export function parseAssetImportWorkbook(workbook: XLSX.WorkBook): {
  rows: ParsedAssetImportRow[];
  parseErrors: AssetImportParseIssue[];
} {
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === "assets") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], parseErrors: [{ excelRow: 1, message: "Excel file has no worksheet" }] };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  if (matrix.length < 2) {
    return { rows: [], parseErrors: [{ excelRow: 1, message: "Add at least one asset row below the header row" }] };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, keyof AssetImportRowPayload>();
  headerRow.forEach((cell, index) => {
    const field = HEADER_ALIASES[normalizeHeader(cell)];
    if (field && field !== "ignore") {
      columnMap.set(index, field);
    }
  });

  if (![...columnMap.values()].includes("assetClass") || ![...columnMap.values()].includes("assetType")) {
    return {
      rows: [],
      parseErrors: [{ excelRow: 1, message: "Missing required columns: Asset Class* and Asset Type*" }]
    };
  }

  const rows: ParsedAssetImportRow[] = [];
  const parseErrors: AssetImportParseIssue[] = [];

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const excelRow = rowIndex + 1;
    const line = matrix[rowIndex] ?? [];
    const values: Record<string, unknown> = {};
    columnMap.forEach((field, columnIndex) => {
      values[field] = line[columnIndex];
    });

    if (rowIsEmpty(values)) {
      continue;
    }

    const mapped = mapRawRow(values);
    if (mapped.error) {
      parseErrors.push({ excelRow, message: mapped.error });
      continue;
    }
    if (mapped.payload) {
      rows.push({ excelRow, payload: mapped.payload });
    }
  }

  return { rows, parseErrors };
}

export async function readAssetImportFile(file: File): Promise<{
  rows: ParsedAssetImportRow[];
  parseErrors: AssetImportParseIssue[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseAssetImportWorkbook(workbook);
}

export function downloadAssetImportTemplate() {
  const instructions = [
    ["Asset Import Instructions"],
    [""],
    ["Required columns (do not rename headers on the Assets sheet):"],
    ["- Asset Class*, Asset Type*, Status*"],
    ["- Project Number is required when Status = IN_USE"],
    ["- Sold Amount and Sold Remark are required when Status = SOLD (or DISPOSED) with an amount"],
    [""],
    ["Status values: IN_USE | IN_STORE | UNDER_REPAIR | SOLD | DISPOSED"],
    ["Dates: DD/MM/YYYY (e.g. 12/03/2026) or YYYY-MM-DD"],
    ["Amounts: numbers only (no currency symbol)"],
    ["Asset Class and Asset Type must match values in Asset Class & Type Setup"],
    [""],
    ["Delete the sample rows before import, or replace them with your data."],
    [""],
    ["Duplicates are not allowed:"],
    ["- Same asset data already entered manually will be skipped"],
    ["- Duplicate rows inside the same Excel file will be skipped"],
    ["- Duplicate IT Asset ID will be skipped"]
  ];

  const emptyRow = Object.fromEntries(ASSET_IMPORT_HEADERS.map((header) => [header, ""]));
  const blankRows = Array.from({ length: 48 }, () => ({ ...emptyRow }));

  const assetsSheet = XLSX.utils.json_to_sheet(blankRows, { header: [...ASSET_IMPORT_HEADERS] });
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  assetsSheet["!cols"] = ASSET_IMPORT_HEADERS.map((header) => ({ wch: Math.max(16, header.length + 2) }));
  assetsSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, assetsSheet, "Assets");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  XLSX.writeFile(workbook, "asset-import-template.xlsx");
}
