import * as XLSX from "xlsx";
import { parseExcelDate } from "./asset-import";
import {
  applySubStaffDefaults,
  emptySubStaffForm,
  type SubStaffFormState
} from "@/components/substaff/SubStaffFormFields";

export const SUB_STAFF_IMPORT_HEADERS = [
  "Staff Name",
  "Designation",
  "Client",
  "Project Number",
  "Co.Ordinator",
  "Rate",
  "CONSTRUCTION PERIOD(MONTHS)",
  "DLP (MONTHS)",
  "EOT (MONTHS)",
  "Total Period of Project",
  "COMMENCEMENT DATE",
  "Last Billed Month",
  "Last Billed Date",
  "MM (CONST. PERIOD)",
  "MM (DLP)",
  "MM (EOT)",
  "TOTAL (MM)",
  "Used MM",
  "REMARK"
] as const;

type FieldKey =
  | "staffName"
  | "designation"
  | "siteName"
  | "projectNumber"
  | "coOrdinator"
  | "rate"
  | "constructionPeriodMonths"
  | "dlpMonths"
  | "eotMonths"
  | "totalPeriodMonths"
  | "startDate"
  | "lastBilledMonth"
  | "lastBilledDate"
  | "mmConstruction"
  | "mmDlp"
  | "mmEot"
  | "totalMm"
  | "usedMm"
  | "remark";

// Matches the client's real "NHAI-Morth" Excel register headers (plus a few sane variants). "Client"
// here is the project's name — it's matched (or a new project is created) by that name on import.
const HEADER_ALIASES: Record<string, FieldKey> = {
  "staff name": "staffName",
  name: "staffName",
  designation: "designation",
  position: "designation",
  client: "siteName",
  site: "siteName",
  "site name": "siteName",
  "project name": "siteName",
  "project number": "projectNumber",
  "project no": "projectNumber",
  "project no.": "projectNumber",
  "co.ordinator": "coOrdinator",
  "co ordinator": "coOrdinator",
  coordinator: "coOrdinator",
  rate: "rate",
  "construction period(months)": "constructionPeriodMonths",
  "construction period (months)": "constructionPeriodMonths",
  "construction period": "constructionPeriodMonths",
  "dlp (months)": "dlpMonths",
  "dlp(months)": "dlpMonths",
  dlp: "dlpMonths",
  "eot (months)": "eotMonths",
  "eot(months)": "eotMonths",
  eot: "eotMonths",
  "total period of project": "totalPeriodMonths",
  "total period": "totalPeriodMonths",
  "commencement date": "startDate",
  "start date": "startDate",
  "last billed month": "lastBilledMonth",
  "last billed date": "lastBilledDate",
  "mm (const. period)": "mmConstruction",
  "mm (construction)": "mmConstruction",
  "mm (dlp)": "mmDlp",
  "mm (eot)": "mmEot",
  "total (mm)": "totalMm",
  "total mm": "totalMm",
  "used mm": "usedMm",
  remark: "remark",
  remarks: "remark"
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Returns the parsed number as text, or flags `invalid` when the cell had content that isn't a number
 * (so the caller can surface it instead of silently importing a blank). */
function cellNumberResult(value: unknown): { text: string; invalid: boolean } {
  if (value === null || value === undefined || value === "") return { text: "", invalid: false };
  const num = Number(value);
  if (Number.isFinite(num)) return { text: String(num), invalid: false };
  return { text: "", invalid: true };
}

function isRowEmpty(values: unknown[]) {
  return values.every((value) => cellString(value) === "");
}

function parseStaffDateCell(value: unknown): { date: string; error?: string } {
  if (value === null || value === undefined || value === "") return { date: "" };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const noon = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    const y = noon.getFullYear();
    const m = String(noon.getMonth() + 1).padStart(2, "0");
    const d = String(noon.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}` };
  }
  const text = cellString(value);
  // The client's own sheet sometimes writes a month as "DEC'25" in this column — leave non-date
  // text alone rather than erroring the whole row over an informational value.
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return { date: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` };
  }
  const parsed = parseExcelDate(value);
  if (parsed) return { date: parsed };
  return { date: "" };
}

export type ParsedSubStaffImportRow = {
  excelRow: number;
  form: SubStaffFormState;
  /** Cells that were missing or couldn't be read as a number/date — the row still imports (left blank
   * or defaulted), but these are surfaced so the user can review and fix them before or after import. */
  issues: string[];
};

export type SubStaffImportParseIssue = { excelRow: number; message: string };

export function downloadSubStaffImportTemplate() {
  const sample = {
    "Staff Name": "A Mahesh",
    Designation: "AHE",
    Client: "MORTH NANDYAL",
    "Project Number": "",
    "Co.Ordinator": "Mr. Ashish Phanse",
    Rate: 65000,
    "CONSTRUCTION PERIOD(MONTHS)": 24,
    "DLP (MONTHS)": 0,
    "EOT (MONTHS)": 0,
    "Total Period of Project": 24,
    "COMMENCEMENT DATE": "15/10/2024",
    "Last Billed Month": "01/07/2026",
    "Last Billed Date": "15/07/2026",
    "MM (CONST. PERIOD)": 24,
    "MM (DLP)": 0,
    "MM (EOT)": 0,
    "TOTAL (MM)": 24,
    "Used MM": 12.84,
    REMARK: ""
  };
  const sheet = XLSX.utils.json_to_sheet([sample], { header: [...SUB_STAFF_IMPORT_HEADERS] });
  sheet["!cols"] = [18, 16, 20, 16, 20, 10, 16, 12, 12, 16, 16, 16, 16, 14, 10, 10, 10, 10, 20].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sub-Professional Staff");

  const guide = XLSX.utils.aoa_to_sheet([
    ["Sub-Professional Staff — Excel Import Guide"],
    [],
    ["This matches your existing NHAI-Morth register columns — only the raw input columns are needed."],
    [],
    ["Client is matched to an existing project by name, or a new project is created automatically if"],
    ["it doesn't exist yet — that new project then shows up everywhere else in the app too."],
    [],
    ["Project Number is optional — leave it blank if you don't have one yet; you (or anyone) can add it"],
    ["later by editing the record, and it updates the real project."],
    [],
    ["Balance MM, elapsed/remaining months and the suggested Days-Per-Month are all calculated"],
    ["automatically in the app from Total MM, Used MM, Commencement Date and Total Period — don't add"],
    ["columns for those."],
    [],
    ["Total Period of Project and TOTAL (MM) default to the sum of their parts if left blank."],
    [],
    ["Import behaviour"],
    ["1", "Valid rows are saved; a row with a problem is skipped and its reason is shown — other rows still import."]
  ]);
  XLSX.utils.book_append_sheet(workbook, guide, "Guide");
  XLSX.writeFile(workbook, "sub-staff-import-sample.xlsx");
}

export function readSubStaffImportFile(file: ArrayBuffer): {
  rows: ParsedSubStaffImportRow[];
  errors: SubStaffImportParseIssue[];
} {
  const workbook = XLSX.read(file, { type: "array", cellDates: false });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() !== "guide") ?? workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [{ excelRow: 0, message: "Excel file has no sheets" }] };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true
  });
  if (!matrix.length) return { rows: [], errors: [{ excelRow: 0, message: "Excel sheet is empty" }] };

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, FieldKey>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key) columnMap.set(index, key);
  });

  if (![...columnMap.values()].includes("staffName")) {
    return {
      rows: [],
      errors: [{ excelRow: 1, message: "Missing required column: Staff Name (use the sample Excel format)" }]
    };
  }

  const rows: ParsedSubStaffImportRow[] = [];
  const errors: SubStaffImportParseIssue[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const excelRow = i + 1;
    const values = matrix[i] ?? [];
    if (isRowEmpty(values)) continue;

    const raw: Partial<Record<FieldKey, unknown>> = {};
    columnMap.forEach((field, colIndex) => {
      raw[field] = values[colIndex];
    });

    const staffName = cellString(raw.staffName);
    if (!staffName) {
      errors.push({ excelRow, message: "Staff Name is required" });
      continue;
    }

    const issues: string[] = [];
    const num = (label: string, rawValue: unknown): string => {
      const { text, invalid } = cellNumberResult(rawValue);
      if (invalid) issues.push(`${label}: "${cellString(rawValue)}" isn't a number — left blank, please fix`);
      return text;
    };
    const startDateParsed = parseStaffDateCell(raw.startDate);
    if (!startDateParsed.date && cellString(raw.startDate)) {
      issues.push(`Commencement Date: "${cellString(raw.startDate)}" isn't a recognized date — left blank, please fix`);
    }
    const siteName = cellString(raw.siteName);
    if (!siteName) issues.push("Client/Project: missing — this row won't be linked to a project until you add one");
    const designation = cellString(raw.designation);
    if (!designation) issues.push("Designation: missing");

    let form: SubStaffFormState = {
      ...emptySubStaffForm,
      staffName,
      designation,
      siteName,
      projectNumber: cellString(raw.projectNumber),
      coOrdinator: cellString(raw.coOrdinator),
      rate: num("Rate", raw.rate),
      constructionPeriodMonths: num("Construction Period", raw.constructionPeriodMonths),
      dlpMonths: num("DLP", raw.dlpMonths),
      eotMonths: num("EOT", raw.eotMonths),
      totalPeriodMonths: num("Total Period", raw.totalPeriodMonths),
      startDate: startDateParsed.date,
      lastBilledMonth: parseStaffDateCell(raw.lastBilledMonth).date,
      lastBilledDate: parseStaffDateCell(raw.lastBilledDate).date,
      mmConstruction: num("MM (Const.)", raw.mmConstruction),
      mmDlp: num("MM (DLP)", raw.mmDlp),
      mmEot: num("MM (EOT)", raw.mmEot),
      totalMm: num("Total MM", raw.totalMm),
      usedMm: num("Used MM", raw.usedMm),
      remark: cellString(raw.remark)
    };
    form = applySubStaffDefaults(form);

    rows.push({ excelRow, form, issues });
  }

  return { rows, errors };
}
