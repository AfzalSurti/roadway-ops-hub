import type { ProjectItem, ProjectRequisitionFormItem } from "./domain";

export type ProjectFinancialDetailsForm = {
  woAmount: string;
  woGstAmount: string;
  woTotalAmount: string;
  excessAmount: string;
  excessGstAmount: string;
  excessTotalAmount: string;
  bgAmount: string;
  bgIssueDate: string;
  bgExpiryDate: string;
  emdAmount: string;
  emdIssueDate: string;
  emdExpiryDate: string;
};

export const EMPTY_PROJECT_FINANCIAL_DETAILS: ProjectFinancialDetailsForm = {
  woAmount: "",
  woGstAmount: "",
  woTotalAmount: "",
  excessAmount: "",
  excessGstAmount: "",
  excessTotalAmount: "",
  bgAmount: "",
  bgIssueDate: "",
  bgExpiryDate: "",
  emdAmount: "",
  emdIssueDate: "",
  emdExpiryDate: ""
};

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export function parseMoneyInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

export function sanitizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

export function computePairTotal(amount: string, gst: string): string {
  const base = parseMoneyInput(amount);
  const tax = parseMoneyInput(gst);
  if (!Number.isFinite(base) || !Number.isFinite(tax)) return "";
  if (!amount.trim() && !gst.trim()) return "";
  return formatMoneyInput(base + tax);
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function projectToFinancialDetailsForm(project: ProjectItem): ProjectFinancialDetailsForm {
  return {
    woAmount: project.woAmount ?? "",
    woGstAmount: project.woGstAmount ?? "",
    woTotalAmount: project.woTotalAmount ?? "",
    excessAmount: project.excessAmount ?? "",
    excessGstAmount: project.excessGstAmount ?? "",
    excessTotalAmount: project.excessTotalAmount ?? "",
    bgAmount: project.bgAmount ?? "",
    bgIssueDate: toDateInputValue(project.bgIssueDate),
    bgExpiryDate: toDateInputValue(project.bgExpiryDate),
    emdAmount: project.emdAmount ?? "",
    emdIssueDate: toDateInputValue(project.emdIssueDate),
    emdExpiryDate: toDateInputValue(project.emdExpiryDate)
  };
}

function validateOptionalMoney(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!MONEY_PATTERN.test(trimmed)) {
    return `${label} must be a valid amount (up to 2 decimal places)`;
  }
  if (parseMoneyInput(trimmed) < 0) {
    return `${label} cannot be negative`;
  }
  return null;
}

function validateDatePair(issue: string, expiry: string, label: string): string | null {
  if (!issue && !expiry) return null;
  if (issue && !expiry) return null;
  if (!issue && expiry) return `${label} issue date is required when expiry date is entered`;
  const issueTime = new Date(`${issue}T00:00:00`).getTime();
  const expiryTime = new Date(`${expiry}T00:00:00`).getTime();
  if (!Number.isFinite(issueTime) || !Number.isFinite(expiryTime)) {
    return `Please enter valid ${label} dates`;
  }
  if (expiryTime < issueTime) {
    return `${label} expiry date cannot be before issue date`;
  }
  return null;
}

export function validateProjectFinancialDetails(form: ProjectFinancialDetailsForm): string | null {
  const moneyChecks: Array<[string, string]> = [
    [form.woAmount, "WO amount"],
    [form.woGstAmount, "WO GST"],
    [form.woTotalAmount, "WO total amount"],
    [form.excessAmount, "Excess/Extra amount"],
    [form.excessGstAmount, "Excess/Extra GST"],
    [form.excessTotalAmount, "Excess/Extra total amount"],
    [form.bgAmount, "BG amount"],
    [form.emdAmount, "EMD amount"]
  ];

  for (const [value, label] of moneyChecks) {
    const error = validateOptionalMoney(value, label);
    if (error) return error;
  }

  const woTotal = computePairTotal(form.woAmount, form.woGstAmount);
  if (form.woTotalAmount.trim() && woTotal && form.woTotalAmount.trim() !== woTotal) {
    return "WO total amount must equal WO amount + GST";
  }

  const excessTotal = computePairTotal(form.excessAmount, form.excessGstAmount);
  if (form.excessTotalAmount.trim() && excessTotal && form.excessTotalAmount.trim() !== excessTotal) {
    return "Excess/Extra total amount must equal amount + GST";
  }

  const bgDateError = validateDatePair(form.bgIssueDate, form.bgExpiryDate, "BG");
  if (bgDateError) return bgDateError;

  const emdDateError = validateDatePair(form.emdIssueDate, form.emdExpiryDate, "EMD");
  if (emdDateError) return emdDateError;

  if (form.bgAmount.trim() && !form.bgIssueDate) {
    return "BG issue date is required when BG amount is entered";
  }
  if (form.emdAmount.trim() && !form.emdIssueDate) {
    return "EMD issue date is required when EMD amount is entered";
  }

  return null;
}

export function normalizeProjectFinancialDetails(form: ProjectFinancialDetailsForm): ProjectFinancialDetailsForm {
  return {
    woAmount: form.woAmount.trim(),
    woGstAmount: form.woGstAmount.trim(),
    woTotalAmount: computePairTotal(form.woAmount, form.woGstAmount) || form.woTotalAmount.trim(),
    excessAmount: form.excessAmount.trim(),
    excessGstAmount: form.excessGstAmount.trim(),
    excessTotalAmount: computePairTotal(form.excessAmount, form.excessGstAmount) || form.excessTotalAmount.trim(),
    bgAmount: form.bgAmount.trim(),
    bgIssueDate: form.bgIssueDate,
    bgExpiryDate: form.bgExpiryDate,
    emdAmount: form.emdAmount.trim(),
    emdIssueDate: form.emdIssueDate,
    emdExpiryDate: form.emdExpiryDate
  };
}

export function financialDetailsDirty(a: ProjectFinancialDetailsForm, b: ProjectFinancialDetailsForm): boolean {
  const left = normalizeProjectFinancialDetails(a);
  const right = normalizeProjectFinancialDetails(b);
  return (Object.keys(left) as Array<keyof ProjectFinancialDetailsForm>).some((key) => left[key] !== right[key]);
}

export function formatMoneyDisplay(value?: string | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "-";
  const parsed = parseMoneyInput(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return parsed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateDisplay(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN");
}

type RequisitionFinancialDraft = {
  workOrderValue: string;
  amountOfWorkOrder: string;
  gstAmount: string;
  totalAmount: string;
  emdAmount: string;
  pgSdAmount: string;
  pgDate: string;
  pgExpiryDate: string;
};

export function applyProjectFinancialToRequisitionDraft<T extends RequisitionFinancialDraft>(
  draft: T,
  project: ProjectItem
): T {
  const financial = projectToFinancialDetailsForm(project);
  const hasSaved = (value: string, defaultZero = false) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (defaultZero && (trimmed === "0" || trimmed === "0.00")) return false;
    return true;
  };

  return {
    ...draft,
    workOrderValue: hasSaved(draft.workOrderValue) ? draft.workOrderValue : financial.woTotalAmount || financial.woAmount || draft.workOrderValue,
    amountOfWorkOrder: hasSaved(draft.amountOfWorkOrder) ? draft.amountOfWorkOrder : financial.woAmount || draft.amountOfWorkOrder,
    gstAmount: hasSaved(draft.gstAmount) ? draft.gstAmount : financial.woGstAmount || draft.gstAmount,
    totalAmount: hasSaved(draft.totalAmount)
      ? draft.totalAmount
      : financial.woTotalAmount || computePairTotal(
          hasSaved(draft.amountOfWorkOrder) ? draft.amountOfWorkOrder : financial.woAmount,
          hasSaved(draft.gstAmount) ? draft.gstAmount : financial.woGstAmount
        ) || draft.totalAmount,
    emdAmount: hasSaved(draft.emdAmount, true) ? draft.emdAmount : financial.emdAmount || draft.emdAmount,
    pgSdAmount: hasSaved(draft.pgSdAmount, true) ? draft.pgSdAmount : financial.bgAmount || draft.pgSdAmount,
    pgDate: draft.pgDate || financial.bgIssueDate || draft.pgDate,
    pgExpiryDate: draft.pgExpiryDate || financial.bgExpiryDate || draft.pgExpiryDate
  };
}

export function projectFinancialDetailsToUpdatePayload(form: ProjectFinancialDetailsForm) {
  const normalized = normalizeProjectFinancialDetails(form);
  return {
    woAmount: normalized.woAmount,
    woGstAmount: normalized.woGstAmount,
    woTotalAmount: normalized.woTotalAmount,
    excessAmount: normalized.excessAmount,
    excessGstAmount: normalized.excessGstAmount,
    excessTotalAmount: normalized.excessTotalAmount,
    bgAmount: normalized.bgAmount,
    bgIssueDate: normalized.bgIssueDate || null,
    bgExpiryDate: normalized.bgExpiryDate || null,
    emdAmount: normalized.emdAmount,
    emdIssueDate: normalized.emdIssueDate || null,
    emdExpiryDate: normalized.emdExpiryDate || null
  };
}
