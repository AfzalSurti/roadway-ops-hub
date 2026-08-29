import * as XLSX from "xlsx";
import type { LetterCategory } from "./domain";
import { parseExcelDate } from "./asset-import";

export const LETTER_IMPORT_HEADERS = [
  "Category*",
  "Sr No",
  "Outward Seq",
  "Letter Number",
  "Letter Date",
  "Sent By",
  "Sent To",
  "Subject",
  "CC To",
  "Subject Category",
  "Letter Link URL",
  "Needs Reply",
  "Reply Of Serial",
  "Remark",
] as const;

export type LetterImportRowPayload = {
  category: LetterCategory;
  serialLabel?: string | null;
  outwardSequence?: string | null;
  letterNumber?: string | null;
  letterDate?: string | null;
  sentBy?: string;
  sentTo?: string;
  subject?: string;
  ccTo?: string;
  subjectCategory?: string;
  letterLinkUrl?: string | null;
  needsReply?: boolean | null;
  replyOfSerial?: string | null;
  remark?: string;
};

export type ParsedLetterImportRow = {
  excelRow: number;
  payload: LetterImportRowPayload;
};

export type LetterImportParseIssue = {
  excelRow: number;
  message: string;
};

type FieldKey = keyof LetterImportRowPayload;

const HEADER_ALIASES: Record<string, FieldKey | "ignore"> = {
  "category*": "category",
  category: "category",
  "letter type": "category",
  "letter type*": "category",
  type: "category",
  "sr no": "serialLabel",
  "sr no.": "serialLabel",
  "sr. no": "serialLabel",
  "sr. no.": "serialLabel",
  serial: "serialLabel",
  "serial label": "serialLabel",
  "serial no": "serialLabel",
  "outward seq": "outwardSequence",
  "outward sequence": "outwardSequence",
  "outward no": "outwardSequence",
  "letter number": "letterNumber",
  "letter no": "letterNumber",
  "letter no.": "letterNumber",
  "existing letter number": "letterNumber",
  "letter date": "letterDate",
  date: "letterDate",
  "sent by": "sentBy",
  from: "sentBy",
  "sent to": "sentTo",
  to: "sentTo",
  subject: "subject",
  "cc to": "ccTo",
  cc: "ccTo",
  "subject category": "subjectCategory",
  "letter link url": "letterLinkUrl",
  "letter link": "letterLinkUrl",
  link: "letterLinkUrl",
  "needs reply": "needsReply",
  "need reply": "needsReply",
  "reply required": "needsReply",
  "reply of serial": "replyOfSerial",
  "reply of": "replyOfSerial",
  "reply letter of": "replyOfSerial",
  remark: "remark",
  remarks: "remark",
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

function parseCategory(value: unknown): LetterCategory | null {
  const raw = cellString(value).toUpperCase().replace(/\s+/g, "_");
  if (!raw) return null;
  if (raw === "INWARD" || raw === "I" || raw === "IN") return "INWARD";
  if (raw === "OUTWARD" || raw === "O" || raw === "OUT") return "OUTWARD";
  if (raw === "OTHER" || raw === "OTH") return "OTHER";
  return null;
}

function parseYesNo(value: unknown): boolean | null | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const raw = cellString(value).toLowerCase();
  if (!raw) return undefined;
  if (["yes", "y", "true", "1", "need", "needed", "required"].includes(raw)) return true;
  if (["no", "n", "false", "0", "not required", "none"].includes(raw)) return false;
  return null;
}

function isRowEmpty(values: unknown[]) {
  return values.every((value) => cellString(value) === "");
}

function parseLetterDateCell(value: unknown): { date: string | null; error?: string } {
  if (value === null || value === undefined || value === "") return { date: null };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Prefer local calendar day from Excel cells (avoids UTC off-by-one).
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}` };
  }
  const text = cellString(value);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return { date: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` };
  }
  const parsed = parseExcelDate(value);
  if (parsed) return { date: parsed };
  if (text) return { date: null, error: `Invalid Letter Date "${text}" — use dd/mm/yyyy` };
  return { date: null };
}

/** Sample Excel for Letter Numbering bulk entry (new + old numbered letters). */
export function downloadLetterImportTemplate() {
  const sampleRows = [
    {
      "Category*": "OUTWARD",
      "Sr No": "01",
      "Outward Seq": "01",
      "Letter Number": "376/GSIR2305R/01/01",
      "Letter Date": "01/04/2024",
      "Sent By": "Project Coordinator",
      "Sent To": "Client Authority",
      Subject: "Old LOA acknowledgement",
      "CC To": "HOD",
      "Subject Category": "Work Order",
      "Letter Link URL": "",
      "Needs Reply": "",
      "Reply Of Serial": "",
      Remark: "Historical letter — keep existing number",
    },
    {
      "Category*": "INWARD",
      "Sr No": "02",
      "Outward Seq": "",
      "Letter Number": "02",
      "Letter Date": "15/04/2024",
      "Sent By": "Client Authority",
      "Sent To": "Project Office",
      Subject: "Query on progress report",
      "CC To": "",
      "Subject Category": "Other",
      "Letter Link URL": "",
      "Needs Reply": "Yes",
      "Reply Of Serial": "",
      Remark: "",
    },
    {
      "Category*": "OUTWARD",
      "Sr No": "",
      "Outward Seq": "",
      "Letter Number": "",
      "Letter Date": "05/08/2026",
      "Sent By": "Project Coordinator",
      "Sent To": "Client Authority",
      Subject: "New letter — auto number",
      "CC To": "",
      "Subject Category": "Other",
      "Letter Link URL": "",
      "Needs Reply": "",
      "Reply Of Serial": "",
      Remark: "Leave Sr No / Letter Number blank to auto-generate",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sampleRows, { header: [...LETTER_IMPORT_HEADERS] });
  sheet["!cols"] = LETTER_IMPORT_HEADERS.map((header) => ({
    wch: Math.max(14, header.length + 2),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Letters");

  const guide = XLSX.utils.aoa_to_sheet([
    ["Letter Numbering — Excel Import Guide"],
    [],
    ["Required"],
    ["Category*", "INWARD, OUTWARD, or OTHER"],
    [],
    ["For old / historical letters (already numbered)"],
    ["Sr No", "Existing serial, e.g. 01, 2, 3a — required if you want to keep old numbering"],
    ["Outward Seq", "Existing outward sequence for OUTWARD, e.g. 01 or 02a"],
    ["Letter Number", "Existing full letter number (paste as already assigned)"],
    [],
    ["For new letters"],
    ["Sr No / Outward Seq / Letter Number", "Leave blank — system auto-generates"],
    [],
    ["Other columns"],
    ["Letter Date", "dd/mm/yyyy (preferred) or Excel date cell"],
    ["Sent By / Sent To / Subject / CC To", "Free text"],
    ["Subject Category", "e.g. Utility, Tender, LAQ, Work Order, Other"],
    ["Needs Reply", "Yes / No — only for INWARD or OTHER"],
    ["Reply Of Serial", "Serial this letter replies to, e.g. 2a"],
    [],
    ["Import behaviour"],
    ["1", "Valid rows are saved; invalid rows are skipped with reason."],
    ["2", "If Sr No already exists in the project, that row fails and others continue."],
  ]);
  XLSX.utils.book_append_sheet(workbook, guide, "Guide");
  XLSX.writeFile(workbook, "letter-numbering-import-sample.xlsx");
}

/** Parse uploaded Excel into valid rows + per-row parse errors. */
export function readLetterImportFile(file: ArrayBuffer): {
  rows: ParsedLetterImportRow[];
  errors: LetterImportParseIssue[];
} {
  const workbook = XLSX.read(file, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() !== "guide") ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ excelRow: 0, message: "Excel file has no sheets" }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!matrix.length) {
    return { rows: [], errors: [{ excelRow: 0, message: "Excel sheet is empty" }] };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, FieldKey>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[normalizeHeader(header)];
    if (key && key !== "ignore") columnMap.set(index, key);
  });

  if (![...columnMap.values()].includes("category")) {
    return {
      rows: [],
      errors: [{ excelRow: 1, message: "Missing required column: Category* (use the sample Excel format)" }],
    };
  }

  const rows: ParsedLetterImportRow[] = [];
  const errors: LetterImportParseIssue[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const excelRow = i + 1;
    const values = matrix[i] ?? [];
    if (isRowEmpty(values)) continue;

    const raw: Partial<Record<FieldKey, unknown>> = {};
    columnMap.forEach((field, colIndex) => {
      raw[field] = values[colIndex];
    });

    const category = parseCategory(raw.category);
    if (!category) {
      errors.push({
        excelRow,
        message: `Invalid Category "${cellString(raw.category)}" — use INWARD, OUTWARD, or OTHER`,
      });
      continue;
    }

    const serialLabel = cellString(raw.serialLabel) || null;
    if (serialLabel && !/^(\d+)([a-z]*)$/i.test(serialLabel)) {
      errors.push({
        excelRow,
        message: `Invalid Sr No "${serialLabel}" — use 01, 2, or 3a`,
      });
      continue;
    }

    const dateResult = parseLetterDateCell(raw.letterDate);
    if (dateResult.error) {
      errors.push({ excelRow, message: dateResult.error });
      continue;
    }

    const needsReplyParsed = parseYesNo(raw.needsReply);
    if (needsReplyParsed === null) {
      errors.push({
        excelRow,
        message: `Invalid Needs Reply "${cellString(raw.needsReply)}" — use Yes or No`,
      });
      continue;
    }
    if (category === "OUTWARD" && needsReplyParsed === true) {
      errors.push({
        excelRow,
        message: "Needs Reply cannot be Yes for OUTWARD letters",
      });
      continue;
    }

    const payload: LetterImportRowPayload = {
      category,
      serialLabel,
      outwardSequence: cellString(raw.outwardSequence) || null,
      letterNumber: cellString(raw.letterNumber) || null,
      letterDate: dateResult.date,
      sentBy: cellString(raw.sentBy) || undefined,
      sentTo: cellString(raw.sentTo) || undefined,
      subject: cellString(raw.subject) || undefined,
      ccTo: cellString(raw.ccTo) || undefined,
      subjectCategory: cellString(raw.subjectCategory) || undefined,
      letterLinkUrl: cellString(raw.letterLinkUrl) || null,
      needsReply: category === "OUTWARD" ? null : needsReplyParsed ?? null,
      replyOfSerial: cellString(raw.replyOfSerial) || null,
      remark: cellString(raw.remark) || undefined,
    };

    rows.push({ excelRow, payload });
  }

  return { rows, errors };
}
