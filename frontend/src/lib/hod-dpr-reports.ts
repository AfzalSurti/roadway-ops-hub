import { DPR_TASK_DATA } from "./dpr-task-catalog";
import type { TaskItem } from "./domain";
import {
  formatHodDate,
  getHodTaskActivityLabel,
  getHodTaskActivityStatus,
  type HodTaskActivityStatus
} from "./hod-dashboard";

export type HodDprReportKey =
  | "INCEPTION"
  | "QAP"
  | "ALIGNMENT_OPTION"
  | "FEASIBILITY"
  | "LA_I"
  | "UTILITY_I"
  | "CLEARANCE_I"
  | "DPR"
  | "LA_II"
  | "UTILITY_II"
  | "CLEARANCE_II"
  | "BID_DOCUMENT"
  | "LA_III"
  | "LA_IV";

export type HodDprReportDefinition = {
  key: HodDprReportKey;
  label: string;
  shortLabel: string;
};

export const HOD_DPR_REPORTS: HodDprReportDefinition[] = [
  { key: "INCEPTION", label: "Inception Report", shortLabel: "Inception" },
  { key: "QAP", label: "QAP", shortLabel: "QAP" },
  { key: "ALIGNMENT_OPTION", label: "Alignment Option Report", shortLabel: "Alignment" },
  { key: "FEASIBILITY", label: "Feasibility Report", shortLabel: "Feasibility" },
  { key: "LA_I", label: "LA-I Report", shortLabel: "LA-I" },
  { key: "UTILITY_I", label: "Utility-I Report", shortLabel: "Util-I" },
  { key: "CLEARANCE_I", label: "Clearance-I Report", shortLabel: "Clr-I" },
  { key: "DPR", label: "Detailed Project Report (DPR)", shortLabel: "DPR" },
  { key: "LA_II", label: "LA-II Report", shortLabel: "LA-II" },
  { key: "UTILITY_II", label: "Utility-II Report", shortLabel: "Util-II" },
  { key: "CLEARANCE_II", label: "Clearance-II Report", shortLabel: "Clr-II" },
  { key: "BID_DOCUMENT", label: "Bid Document", shortLabel: "Bid Doc" },
  { key: "LA_III", label: "LA-III Report", shortLabel: "LA-III" },
  { key: "LA_IV", label: "LA-IV Report", shortLabel: "LA-IV" }
];

const CATEGORY_TO_REPORT: Record<string, HodDprReportKey> = {
  "LA-I Report": "LA_I",
  "Utility-I Report": "UTILITY_I",
  "Clearance-I Report": "CLEARANCE_I",
  "Detailed Project Report (DPR)": "DPR",
  "Bid documents and civil works contract agreement": "BID_DOCUMENT",
  "LA-II Report": "LA_II",
  "Utility-II Report": "UTILITY_II",
  "Clearance-II Report": "CLEARANCE_II",
  "Land Award Report (LA-III Report)": "LA_III",
  "Land possession Report (LA-IV Report)": "LA_IV"
};

const ALIGNMENT_OPTION_TITLES = new Set(
  [
    "Submission of Draft Alignment Option Report & Presentation",
    "Submission of Final Alignment Report",
    "Approval of Final Alignment Report",
    "Geometric Design for various Alignment options",
    "Submission of Alignment/Strip plan and Alignment Drawing (TCS)"
  ].map((item) => item.toLowerCase())
);

export type HodDprReportStatusSnapshot = {
  key: HodDprReportKey;
  label: string;
  shortLabel: string;
  status: HodTaskActivityStatus;
  statusLabel: string;
  taskCount: number;
  submissionDate: string | null;
  approvalDate: string | null;
};

export function resolveTaskCategory(task: TaskItem): string | null {
  const title = task.title.trim();
  if (!title || title === "Other") {
    return null;
  }

  for (const [category, subtasks] of Object.entries(DPR_TASK_DATA)) {
    if (subtasks.includes(title)) {
      return category;
    }
  }

  const lowered = title.toLowerCase();
  for (const [category, subtasks] of Object.entries(DPR_TASK_DATA)) {
    if (subtasks.some((subtask) => lowered.includes(subtask.toLowerCase().slice(0, Math.min(24, subtask.length))))) {
      return category;
    }
  }

  return null;
}

export function resolveDprReportKey(task: TaskItem): HodDprReportKey | null {
  const title = task.title.trim().toLowerCase();
  const category = resolveTaskCategory(task);

  if (title.includes("qap")) {
    return "QAP";
  }

  if (category === "Inception Report & QAP") {
    return "INCEPTION";
  }

  if (category === "Feasibility Report") {
    if (ALIGNMENT_OPTION_TITLES.has(title) || title.includes("alignment option") || title.includes("alignment report")) {
      return "ALIGNMENT_OPTION";
    }
    return "FEASIBILITY";
  }

  if (category && CATEGORY_TO_REPORT[category]) {
    return CATEGORY_TO_REPORT[category];
  }

  if (title.includes("la-iv") || title.includes("land possession")) return "LA_IV";
  if (title.includes("la-iii") || title.includes("land award")) return "LA_III";
  if (title.includes("la-ii")) return "LA_II";
  if (title.includes("la-i")) return "LA_I";
  if (title.includes("utility-ii")) return "UTILITY_II";
  if (title.includes("utility-i")) return "UTILITY_I";
  if (title.includes("clearance-ii")) return "CLEARANCE_II";
  if (title.includes("clearance-i")) return "CLEARANCE_I";
  if (title.includes("bid document") || title.includes("rfp") || title.includes("nit")) return "BID_DOCUMENT";
  if (title.includes("feasibility")) return "FEASIBILITY";
  if (title.includes("inception")) return "INCEPTION";
  if (title.includes("dpr")) return "DPR";

  return null;
}

function maxDate(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) {
    return null;
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

export function aggregateDprReportStatus(reportTasks: TaskItem[]): Omit<HodDprReportStatusSnapshot, "key" | "label" | "shortLabel"> {
  if (reportTasks.length === 0) {
    return {
      status: "NOT_STARTED",
      statusLabel: getHodTaskActivityLabel("NOT_STARTED"),
      taskCount: 0,
      submissionDate: null,
      approvalDate: null
    };
  }

  const statuses = reportTasks.map((task) => getHodTaskActivityStatus(task));
  const allApproved = statuses.every((status) => status === "APPROVED");
  const anySubmitted = statuses.some((status) => status === "TASK_COMPLETED" || status === "APPROVED");
  const anyPending = statuses.some((status) => status === "TASK_PENDING");

  let status: HodTaskActivityStatus = "TASK_PENDING";
  if (allApproved) {
    status = "APPROVED";
  } else if (anySubmitted) {
    status = "TASK_COMPLETED";
  } else if (anyPending) {
    status = "TASK_PENDING";
  }

  return {
    status,
    statusLabel: getHodTaskActivityLabel(status),
    taskCount: reportTasks.length,
    submissionDate: formatHodDate(
      maxDate(reportTasks.map((task) => task.submittedForReviewAt ?? task.actualCompletedAt))
    ),
    approvalDate: formatHodDate(maxDate(reportTasks.map((task) => task.reviewCompletedAt)))
  };
}

export function buildProjectDprReportStatuses(projectTasks: TaskItem[]): HodDprReportStatusSnapshot[] {
  const buckets = new Map<HodDprReportKey, TaskItem[]>();
  HOD_DPR_REPORTS.forEach((report) => buckets.set(report.key, []));

  for (const task of projectTasks) {
    const reportKey = resolveDprReportKey(task);
    if (!reportKey) continue;
    buckets.get(reportKey)!.push(task);
  }

  return HOD_DPR_REPORTS.map((report) => ({
    key: report.key,
    label: report.label,
    shortLabel: report.shortLabel,
    ...aggregateDprReportStatus(buckets.get(report.key) ?? [])
  }));
}

export function getDprReportStatusTone(status: HodTaskActivityStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500/20 text-emerald-700 border-emerald-500/30";
    case "TASK_COMPLETED":
      return "bg-sky-500/20 text-sky-700 border-sky-500/30";
    case "TASK_PENDING":
      return "bg-amber-500/20 text-amber-800 border-amber-500/30";
    default:
      return "bg-muted/80 text-muted-foreground border-border/50";
  }
}
