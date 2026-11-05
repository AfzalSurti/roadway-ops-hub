import * as XLSX from "xlsx";
import { parseExcelDate } from "./asset-import";
import { applyAutoCalc, emptyBillForm, type BillFormState } from "@/components/billing/BillFormFields";

export const BILLING_IMPORT_HEADERS = [
  "Date",
  "RA Bill No.",
  "Bill No.",
  "Month",
  "Basic Amount Claimed",
  "Basic Amount Passed by Client",
  "TDS",
  "SD / Retention Money",
  "GST",
  "Chq. Amt",
  "GST Received"
] as const;

type FieldKey =
  | "date"
  | "raBillNo"
  | "billNo"
  | "month"
  | "basicAmountClaimed"
  | "basicAmountPassed"
  | "tds"
  | "sdRetention"
  | "gstDeduction"
  | "chequeAmount"
  | "gstReceived";

const HEADER_ALIASES: Record<string, FieldKey> = {
  date: "date",
  "bill date": "date",
  "ra bill no": "raBillNo",
  "ra bill no.": "raBillNo",
  "ra bill number": "raBillNo",
  "bill no": "billNo",
  "bill no.": "billNo",
  "bill number": "billNo",
  month: "month",
  "basic amount claimed": "basicAmountClaimed",
  "amount claimed": "basicAmountClaimed",
  claimed: "basicAmountClaimed",
  "basic amount passed by client": "basicAmountPassed",
  "basic amount passed": "basicAmountPassed",
  "amount passed": "basicAmountPassed",
  passed: "basicAmountPassed",
  tds: "tds",
  "sd / retention money": "sdRetention",
  "sd/retention money": "sdRetention",
  "sd retention money": "sdRetention",
  "retention money": "sdRetention",
  sd: "sdRetention",
  retention: "sdRetention",
  gst: "gstDeduction",
  "gst (deduction)": "gstDeduction",
  "chq. amt": "chequeAmount",
  "chq amt": "chequeAmount",
  "cheque amount": "chequeAmount",
  "gst received": "gstReceived"
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

function cellNumberString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

function isRowEmpty(values: unknown[]) {
  return values.every((value) => cellString(value) === "");
}

function parseBillingDateCell(value: unknown): { date: string; error?: string } {
  if (value === null || value === undefined || value === "") return { date: "" };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Shift by 12h before reading the local day so a few-minute reader skew around midnight can't move it.
    const noon = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    const y = noon.getFullYear();
    const m = String(noon.getMonth() + 1).padStart(2, "0");
    const d = String(noon.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}` };
  }
  const text = cellString(value);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return { date: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` };
  }
  const parsed = parseExcelDate(value);
  if (parsed) return { date: parsed };
  if (text) return { date: "", error: `Invalid Date "${text}" — use dd/mm/yyyy` };
  return { date: "" };
}

export type ParsedBillingImportRow = {
  excelRow: number;
  form: BillFormState;
};

export type BillingImportParseIssue = { excelRow: number; message: string };

/** Downloads a sample Excel for bulk bill entry — only the manual fields; everything auto-calculated is left out. */
export function downloadBillingImportTemplate() {
  const sample = {
    Date: "05/08/2025",
    "RA Bill No.": "RA-12",
    "Bill No.": "12",
    Month: "August 2025",
    "Basic Amount Claimed": 100000,
    "Basic Amount Passed by Client": 95000,
    TDS: 1900,
    "SD / Retention Money": 4750,
    GST: 1900,
    "Chq. Amt": 100000,
    "GST Received": 17100
  };
  const sheet = XLSX.utils.json_to_sheet([sample], { header: [...BILLING_IMPORT_HEADERS] });
  sheet["!cols"] = [14, 16, 12, 18, 20, 26, 12, 18, 12, 14, 14].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Bills");

  const guide = XLSX.utils.aoa_to_sheet([
    ["Billing — Excel Import Guide"],
    [],
    ["Nothing is required — fill in whatever applies, leave the rest blank."],
    [],
    ["Date", "dd/mm/yyyy (preferred) or an Excel date cell"],
    [
      "Basic Amount Claimed / Passed",
      "18% GST, Total Amount, Credit Note and Amount to be Received are all calculated automatically — don't add columns for those"
    ],
    ["TDS / SD / GST / Chq. Amt / GST Received", "Enter these directly — contract-specific, no fixed formula"],
    [],
    ["Import behaviour"],
    [
      "1",
      "Valid rows are saved; a row with a problem (e.g. an unreadable date) is skipped and its reason is shown — other rows still import."
    ]
  ]);
  XLSX.utils.book_append_sheet(workbook, guide, "Guide");
  XLSX.writeFile(workbook, "billing-import-sample.xlsx");
}

/** Parse an uploaded Excel into rows ready to send, with the same auto-calc chain the Add Bill form uses. */
export function readBillingImportFile(file: ArrayBuffer): {
  rows: ParsedBillingImportRow[];
  errors: BillingImportParseIssue[];
} {
  // cellDates stays off on purpose — see asset-import.ts / letter-import.ts for why.
  const workbook = XLSX.read(file, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() !== "guide") ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ excelRow: 0, message: "Excel file has no sheets" }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true
  });
  if (!matrix.length) {
    return { rows: [], errors: [{ excelRow: 0, message: "Excel sheet is empty" }] };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, FieldKey>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key) columnMap.set(index, key);
  });

  const rows: ParsedBillingImportRow[] = [];
  const errors: BillingImportParseIssue[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const excelRow = i + 1;
    const values = matrix[i] ?? [];
    if (isRowEmpty(values)) continue;

    const raw: Partial<Record<FieldKey, unknown>> = {};
    columnMap.forEach((field, colIndex) => {
      raw[field] = values[colIndex];
    });

    const dateResult = parseBillingDateCell(raw.date);
    if (dateResult.error) {
      errors.push({ excelRow, message: dateResult.error });
      continue;
    }

    let form: BillFormState = {
      ...emptyBillForm,
      date: dateResult.date,
      raBillNo: cellString(raw.raBillNo),
      billNo: cellString(raw.billNo),
      month: cellString(raw.month),
      basicAmountClaimed: cellNumberString(raw.basicAmountClaimed),
      basicAmountPassed: cellNumberString(raw.basicAmountPassed),
      tds: cellNumberString(raw.tds),
      sdRetention: cellNumberString(raw.sdRetention),
      gstDeduction: cellNumberString(raw.gstDeduction),
      chequeAmount: cellNumberString(raw.chequeAmount),
      gstReceived: cellNumberString(raw.gstReceived)
    };
    // Same auto-calc chain the Add Bill form uses as you type: claim -> GST/Total/Credit,
    // then TDS -> Amount to be Received, then Chq. Amt -> Amt Hold.
    form = applyAutoCalc(form, "basicAmountClaimed");
    form = applyAutoCalc(form, "tds");
    form = applyAutoCalc(form, "chequeAmount");

    rows.push({ excelRow, form });
  }

  return { rows, errors };
}
