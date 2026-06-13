import * as XLSX from "xlsx";
import type { ProjectItem, ProjectRequisitionFormItem } from "./domain";
import { parseExcelDate } from "./asset-import";

export const PROJECT_IMPORT_HEADERS = [
  "Project Name*",
  "Project Number*",
  "Project Description",
  "Cost Centre / Department*",
  "HOD / Director Name*",
  "Application Date*",
  "Client Name*",
  "Billing Name*",
  "Address with Pincode",
  "Pincode",
  "GST Number",
  "GST Type",
  "Contact Name",
  "Contact Number",
  "Designation",
  "Department",
  "PAN / TAN Number",
  "Email",
  "Work Order Value",
  "Work Order Date",
  "Agreement Number",
  "Agreement Date",
  "Project Starting Date*",
  "Project Duration (days)*",
  "Project Completion Date",
  "Work Order Number",
  "New Project Number",
  "Amount of Work Order*",
  "GST Amount*",
  "Total Amount",
  "EMD Amount",
  "PG / SD Amount",
  "PG Date",
  "PG Expiry Date",
  "Name of Work*",
  "Location (District)",
  "State",
  "Approved Project Number*",
  "Approved By*"
] as const;

export type ProjectImportRowPayload = {
  projectName: string;
  projectNumber: string;
  projectDescription?: string | null;
  costCentreDepartment: string;
  hodDirectorName: string;
  applicationDate: string;
  clientName: string;
  billingName: string;
  addressWithPincode?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  gstType: "REGISTERED" | "UNREGISTERED";
  contactName?: string | null;
  contactNumber?: string | null;
  designation?: string | null;
  department?: string | null;
  panTanNumber?: string | null;
  email?: string | null;
  workOrderValue?: string | null;
  workOrderDate?: string | null;
  agreementNumber?: string | null;
  agreementDate?: string | null;
  projectStartingDate: string;
  projectDurationDays: number;
  projectCompletionDate: string;
  workOrderNumber?: string | null;
  newProjectNumber?: string | null;
  amountOfWorkOrder: string;
  gstAmount: string;
  totalAmount: string;
  emdAmount?: string | null;
  pgSdAmount?: string | null;
  pgDate?: string | null;
  pgExpiryDate?: string | null;
  nameOfWork: string;
  locationDistrict?: string | null;
  state?: string | null;
  approvedProjectNumber: string;
  approvedBy: string;
};

export type ParsedProjectImportRow = {
  excelRow: number;
  payload: ProjectImportRowPayload;
};

export type ProjectImportParseIssue = {
  excelRow: number;
  message: string;
};

type ImportFieldKey = keyof ProjectImportRowPayload;

const HEADER_ALIASES: Record<string, ImportFieldKey | "ignore"> = {
  "project name*": "projectName",
  "project name": "projectName",
  "project number*": "projectNumber",
  "project number": "projectNumber",
  "project description": "projectDescription",
  "cost centre / department*": "costCentreDepartment",
  "cost centre / department": "costCentreDepartment",
  "cost center / department*": "costCentreDepartment",
  "cost center / department": "costCentreDepartment",
  "hod / director name*": "hodDirectorName",
  "hod / director name": "hodDirectorName",
  "application date*": "applicationDate",
  "application date": "applicationDate",
  "client name*": "clientName",
  "client name": "clientName",
  "billing name*": "billingName",
  "billing name": "billingName",
  "address with pincode": "addressWithPincode",
  pincode: "pincode",
  "gst number": "gstNumber",
  "gst type": "gstType",
  "contact name": "contactName",
  "contact number": "contactNumber",
  designation: "designation",
  department: "department",
  "pan / tan number": "panTanNumber",
  email: "email",
  "work order value": "workOrderValue",
  "work order date": "workOrderDate",
  "agreement number": "agreementNumber",
  "agreement date": "agreementDate",
  "project starting date*": "projectStartingDate",
  "project starting date": "projectStartingDate",
  "project duration (days)*": "projectDurationDays",
  "project duration (days)": "projectDurationDays",
  "project completion date": "projectCompletionDate",
  "work order number": "workOrderNumber",
  "new project number": "newProjectNumber",
  "amount of work order*": "amountOfWorkOrder",
  "amount of work order": "amountOfWorkOrder",
  "gst amount*": "gstAmount",
  "gst amount": "gstAmount",
  "total amount": "totalAmount",
  "emd amount": "emdAmount",
  "pg / sd amount": "pgSdAmount",
  "pg date": "pgDate",
  "pg expiry date": "pgExpiryDate",
  "name of work*": "nameOfWork",
  "name of work": "nameOfWork",
  "location (district)": "locationDistrict",
  state: "state",
  "approved project number*": "approvedProjectNumber",
  "approved project number": "approvedProjectNumber",
  "approved by*": "approvedBy",
  "approved by": "approvedBy"
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseMoneyText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(numeric)) return String(value).trim();
  return numeric.toFixed(2);
}

function computeTotalAmount(amountOfWorkOrder: string, gstAmount: string, totalAmount: string): string {
  if (totalAmount.trim()) return totalAmount.trim();
  const base = Number(amountOfWorkOrder.replace(/,/g, ""));
  const tax = Number(gstAmount.replace(/,/g, ""));
  if (!Number.isFinite(base) || !Number.isFinite(tax)) return "";
  return (base + tax).toFixed(2);
}

function addDaysIso(dateText: string, days: number): string {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseGstType(value: unknown): "REGISTERED" | "UNREGISTERED" | null {
  const text = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!text || text === "REGISTERED") return "REGISTERED";
  if (text === "UNREGISTERED") return "UNREGISTERED";
  return null;
}

function rowIsEmpty(values: Record<string, unknown>): boolean {
  return !String(values.projectName ?? "").trim() && !String(values.projectNumber ?? "").trim();
}

function mapRawRow(values: Record<string, unknown>): { payload?: ProjectImportRowPayload; error?: string } {
  const projectName = String(values.projectName ?? "").trim();
  if (!projectName) return { error: "Project Name is required" };

  const projectNumber = String(values.projectNumber ?? "").trim().toUpperCase();
  if (!projectNumber) return { error: "Project Number is required" };

  const costCentreDepartment = String(values.costCentreDepartment ?? "").trim();
  if (!costCentreDepartment) return { error: "Cost Centre / Department is required" };

  const hodDirectorName = String(values.hodDirectorName ?? "").trim();
  if (!hodDirectorName) return { error: "HOD / Director Name is required" };

  const applicationDate = parseExcelDate(values.applicationDate);
  if (!applicationDate) return { error: "Application Date is required (use DD/MM/YYYY or YYYY-MM-DD)" };

  const clientName = String(values.clientName ?? "").trim();
  if (!clientName) return { error: "Client Name is required" };

  const billingName = String(values.billingName ?? "").trim();
  if (!billingName) return { error: "Billing Name is required" };

  const projectStartingDate = parseExcelDate(values.projectStartingDate);
  if (!projectStartingDate) return { error: "Project Starting Date is required (use DD/MM/YYYY or YYYY-MM-DD)" };

  const durationRaw = values.projectDurationDays;
  const durationText = String(durationRaw ?? "").trim();
  if (!durationText) return { error: "Project Duration (days) is required" };
  const projectDurationDays = Number(durationText.replace(/,/g, ""));
  if (!Number.isFinite(projectDurationDays) || projectDurationDays < 0) {
    return { error: "Project Duration (days) must be a valid number >= 0" };
  }

  let projectCompletionDate = parseExcelDate(values.projectCompletionDate);
  if (!projectCompletionDate && projectDurationDays > 0) {
    projectCompletionDate = addDaysIso(projectStartingDate, projectDurationDays);
  }
  if (!projectCompletionDate) {
    return { error: "Project Completion Date is required or must be derivable from start date and duration" };
  }

  const amountOfWorkOrder = parseMoneyText(values.amountOfWorkOrder);
  if (!amountOfWorkOrder) return { error: "Amount of Work Order is required" };

  const gstRaw = values.gstAmount;
  if (gstRaw === undefined || gstRaw === null || String(gstRaw).trim() === "") {
    return { error: "GST Amount is required" };
  }
  const gstAmount = parseMoneyText(gstRaw);
  if (!gstAmount && String(gstRaw).trim() !== "0" && String(gstRaw).trim() !== "0.00") {
    return { error: "GST Amount must be a valid number >= 0" };
  }
  const normalizedGstAmount = gstAmount || "0.00";

  const nameOfWork = String(values.nameOfWork ?? "").trim();
  if (!nameOfWork) return { error: "Name of Work is required" };

  const approvedProjectNumber = String(values.approvedProjectNumber ?? projectNumber).trim().toUpperCase();
  if (!approvedProjectNumber) return { error: "Approved Project Number is required" };

  const approvedBy = String(values.approvedBy ?? "").trim();
  if (!approvedBy) return { error: "Approved By is required" };

  const gstType = parseGstType(values.gstType);
  if (values.gstType && String(values.gstType).trim() && !gstType) {
    return { error: "GST Type must be REGISTERED or UNREGISTERED" };
  }

  const workOrderDate = parseExcelDate(values.workOrderDate);
  if (values.workOrderDate && !workOrderDate) {
    return { error: "Work Order Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const agreementDate = parseExcelDate(values.agreementDate);
  if (values.agreementDate && !agreementDate) {
    return { error: "Agreement Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const pgDate = parseExcelDate(values.pgDate);
  if (values.pgDate && !pgDate) {
    return { error: "PG Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const pgExpiryDate = parseExcelDate(values.pgExpiryDate);
  if (values.pgExpiryDate && !pgExpiryDate) {
    return { error: "PG Expiry Date is not a valid date (use DD/MM/YYYY or YYYY-MM-DD)" };
  }

  const totalAmount = computeTotalAmount(amountOfWorkOrder, normalizedGstAmount, parseMoneyText(values.totalAmount));

  return {
    payload: {
      projectName,
      projectNumber,
      projectDescription: String(values.projectDescription ?? "").trim() || null,
      costCentreDepartment,
      hodDirectorName,
      applicationDate,
      clientName,
      billingName,
      addressWithPincode: String(values.addressWithPincode ?? "").trim() || null,
      pincode: String(values.pincode ?? "").trim() || null,
      gstNumber: String(values.gstNumber ?? "").trim() || null,
      gstType: gstType ?? "REGISTERED",
      contactName: String(values.contactName ?? "").trim() || null,
      contactNumber: String(values.contactNumber ?? "").trim() || null,
      designation: String(values.designation ?? "").trim() || null,
      department: String(values.department ?? "").trim() || null,
      panTanNumber: String(values.panTanNumber ?? "").trim() || null,
      email: String(values.email ?? "").trim() || null,
      workOrderValue: parseMoneyText(values.workOrderValue) || totalAmount || amountOfWorkOrder,
      workOrderDate: workOrderDate ?? null,
      agreementNumber: String(values.agreementNumber ?? "").trim() || null,
      agreementDate: agreementDate ?? null,
      projectStartingDate,
      projectDurationDays,
      projectCompletionDate,
      workOrderNumber: String(values.workOrderNumber ?? "").trim() || null,
      newProjectNumber: String(values.newProjectNumber ?? projectNumber).trim().toUpperCase() || projectNumber,
      amountOfWorkOrder,
      gstAmount: normalizedGstAmount,
      totalAmount,
      emdAmount: parseMoneyText(values.emdAmount) || "0.00",
      pgSdAmount: parseMoneyText(values.pgSdAmount) || "0.00",
      pgDate: pgDate ?? null,
      pgExpiryDate: pgExpiryDate ?? null,
      nameOfWork,
      locationDistrict: String(values.locationDistrict ?? "").trim() || null,
      state: String(values.state ?? "").trim() || null,
      approvedProjectNumber,
      approvedBy
    }
  };
}

export function parseProjectImportWorkbook(workbook: XLSX.WorkBook): {
  rows: ParsedProjectImportRow[];
  parseErrors: ProjectImportParseIssue[];
} {
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "projects") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { rows: [], parseErrors: [{ excelRow: 1, message: "Excel file has no worksheet" }] };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  if (matrix.length < 2) {
    return { rows: [], parseErrors: [{ excelRow: 1, message: "Add at least one project row below the header row" }] };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, ImportFieldKey>();
  headerRow.forEach((cell, index) => {
    const field = HEADER_ALIASES[normalizeHeader(cell)];
    if (field && field !== "ignore") {
      columnMap.set(index, field);
    }
  });

  if (![...columnMap.values()].includes("projectName") || ![...columnMap.values()].includes("projectNumber")) {
    return {
      rows: [],
      parseErrors: [{ excelRow: 1, message: "Missing required columns: Project Name* and Project Number*" }]
    };
  }

  const rows: ParsedProjectImportRow[] = [];
  const parseErrors: ProjectImportParseIssue[] = [];
  const batchProjectNumbers = new Map<string, number>();
  const batchProjectNames = new Map<string, number>();

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
      const numberKey = mapped.payload.projectNumber.toUpperCase();
      const nameKey = mapped.payload.projectName.trim().toLowerCase();
      const duplicateNumberRow = batchProjectNumbers.get(numberKey);
      if (duplicateNumberRow !== undefined) {
        parseErrors.push({
          excelRow,
          message: `Duplicate Project Number "${mapped.payload.projectNumber}" (same as row ${duplicateNumberRow})`
        });
        continue;
      }
      const duplicateNameRow = batchProjectNames.get(nameKey);
      if (duplicateNameRow !== undefined) {
        parseErrors.push({
          excelRow,
          message: `Duplicate Project Name "${mapped.payload.projectName}" (same as row ${duplicateNameRow})`
        });
        continue;
      }
      batchProjectNumbers.set(numberKey, excelRow);
      batchProjectNames.set(nameKey, excelRow);
      rows.push({ excelRow, payload: mapped.payload });
    }
  }

  return { rows, parseErrors };
}

export async function readProjectImportFile(file: File): Promise<{
  rows: ParsedProjectImportRow[];
  parseErrors: ProjectImportParseIssue[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseProjectImportWorkbook(workbook);
}

function formatDateForExport(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export function buildProjectExportRows(
  projects: ProjectItem[],
  requisitionFormsByProjectId: Map<string, ProjectRequisitionFormItem>
) {
  return projects.map((project) => {
    const form = requisitionFormsByProjectId.get(project.id);
    return {
      "Project Name*": project.name,
      "Project Number*": project.projectNumber ?? "",
      "Project Description": project.description ?? "",
      "Cost Centre / Department*": form?.costCentreDepartment ?? "",
      "HOD / Director Name*": form?.hodDirectorName ?? "",
      "Application Date*": formatDateForExport(form?.applicationDate),
      "Client Name*": form?.clientName ?? "",
      "Billing Name*": form?.billingName ?? "",
      "Address with Pincode": form?.addressWithPincode ?? "",
      Pincode: form?.pincode ?? "",
      "GST Number": form?.gstNumber ?? "",
      "GST Type": form?.gstType ?? "REGISTERED",
      "Contact Name": form?.contactName ?? "",
      "Contact Number": form?.contactNumber ?? "",
      Designation: form?.designation ?? "",
      Department: form?.department ?? "",
      "PAN / TAN Number": form?.panTanNumber ?? "",
      Email: form?.email ?? "",
      "Work Order Value": form?.workOrderValue ?? project.woTotalAmount ?? project.woAmount ?? "",
      "Work Order Date": formatDateForExport(form?.workOrderDate),
      "Agreement Number": form?.agreementNumber ?? "",
      "Agreement Date": formatDateForExport(form?.agreementDate),
      "Project Starting Date*": formatDateForExport(form?.projectStartingDate),
      "Project Duration (days)*": form?.projectDurationDays ?? "",
      "Project Completion Date": formatDateForExport(form?.projectCompletionDate),
      "Work Order Number": form?.workOrderNumber ?? "",
      "New Project Number": form?.newProjectNumber ?? project.projectNumber ?? "",
      "Amount of Work Order*": form?.amountOfWorkOrder ?? project.woAmount ?? "",
      "GST Amount*": form?.gstAmount ?? project.woGstAmount ?? "",
      "Total Amount": form?.totalAmount ?? project.woTotalAmount ?? "",
      "EMD Amount": form?.emdAmount ?? project.emdAmount ?? "",
      "PG / SD Amount": form?.pgSdAmount ?? project.bgAmount ?? "",
      "PG Date": formatDateForExport(form?.pgDate ?? project.bgIssueDate),
      "PG Expiry Date": formatDateForExport(form?.pgExpiryDate ?? project.bgExpiryDate),
      "Name of Work*": form?.nameOfWork ?? "",
      "Location (District)": form?.locationDistrict ?? "",
      State: form?.state ?? "",
      "Approved Project Number*": form?.approvedProjectNumber ?? project.projectNumber ?? "",
      "Approved By*": form?.approvedBy ?? ""
    };
  });
}

export function downloadProjectImportTemplate() {
  const instructions = [
    ["Project & Requisition Import Instructions"],
    [""],
    ["Required columns (do not rename headers on the Projects sheet):"],
    ["- Project Name*, Project Number*"],
    ["- Cost Centre / Department*, HOD / Director Name*, Application Date*"],
    ["- Client Name*, Billing Name*"],
    ["- Project Starting Date*, Project Duration (days)*"],
    ["- Amount of Work Order*, GST Amount*"],
    ["- Name of Work*, Approved Project Number*, Approved By*"],
    [""],
    ["Dates: DD/MM/YYYY (e.g. 12/03/2026) or YYYY-MM-DD"],
    ["Amounts: numbers only (no currency symbol). Total Amount auto-calculates if left blank."],
    ["GST Type: REGISTERED or UNREGISTERED (default REGISTERED)"],
    [""],
    ["Each row creates or updates one project and its requisition form."],
    ["If Project Number already exists, that project and requisition form are updated."],
    ["Rows with missing or invalid fields are skipped; valid rows still import."],
    [""],
    ["Delete sample rows before import, or replace them with your data."]
  ];

  const sampleRow = {
    "Project Name*": "Sample Elevated Corridor Project",
    "Project Number*": "GSAE2401S",
    "Project Description": "Consultancy services sample",
    "Cost Centre / Department*": "Highway",
    "HOD / Director Name*": "Director Name",
    "Application Date*": "01/04/2026",
    "Client Name*": "Client Organisation",
    "Billing Name*": "Billing Contact",
    "Address with Pincode": "Sample Address",
    Pincode: "380001",
    "GST Number": "24AAAAA0000A1Z5",
    "GST Type": "REGISTERED",
    "Contact Name": "Contact Person",
    "Contact Number": "9876543210",
    Designation: "Engineer",
    Department: "Projects",
    "PAN / TAN Number": "ABCDE1234F",
    Email: "contact@example.com",
    "Work Order Value": "101834492.00",
    "Work Order Date": "01/04/2026",
    "Agreement Number": "",
    "Agreement Date": "",
    "Project Starting Date*": "01/04/2026",
    "Project Duration (days)*": "365",
    "Project Completion Date": "",
    "Work Order Number": "WO-001",
    "New Project Number": "GSAE2401S",
    "Amount of Work Order*": "86304654.24",
    "GST Amount*": "15534837.76",
    "Total Amount": "101834492.00",
    "EMD Amount": "0.00",
    "PG / SD Amount": "0.00",
    "PG Date": "",
    "PG Expiry Date": "",
    "Name of Work*": "Consultancy services for elevated corridor",
    "Location (District)": "Ahmedabad",
    State: "Gujarat",
    "Approved Project Number*": "GSAE2401S",
    "Approved By*": "Approver Name"
  };

  const emptyRow = Object.fromEntries(PROJECT_IMPORT_HEADERS.map((header) => [header, ""]));
  const blankRows = Array.from({ length: 24 }, () => ({ ...emptyRow }));

  const projectsSheet = XLSX.utils.json_to_sheet([sampleRow, ...blankRows], { header: [...PROJECT_IMPORT_HEADERS] });
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  projectsSheet["!cols"] = PROJECT_IMPORT_HEADERS.map((header) => ({ wch: Math.max(18, header.length + 2) }));
  projectsSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, projectsSheet, "Projects");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
  XLSX.writeFile(workbook, "project-requisition-import-template.xlsx");
}

export function downloadProjectExport(
  projects: ProjectItem[],
  requisitionFormsByProjectId: Map<string, ProjectRequisitionFormItem>,
  fileName = "projects-with-requisition.xlsx"
) {
  const rows = buildProjectExportRows(projects, requisitionFormsByProjectId);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...PROJECT_IMPORT_HEADERS] });
  sheet["!cols"] = PROJECT_IMPORT_HEADERS.map((header) => ({ wch: Math.max(18, header.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Projects");
  XLSX.writeFile(workbook, fileName);
}
