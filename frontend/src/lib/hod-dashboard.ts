import type { ProjectItem, TaskItem } from "./domain";

export const HOD_COMPANY_OPTIONS = [
  { label: "Geo Designs & Research Pvt. Ltd", code: "G" },
  { label: "Sai Geotechnical Lab", code: "S" },
  { label: "Inertia Engineering Solution", code: "I" },
  { label: "Shree Hari Testing Lab", code: "H" }
] as const;

export const HOD_TECHNICAL_UNIT_OPTIONS = [
  { label: "Testing Consultancy", code: "T" },
  { label: "Supervision Consultancy", code: "S" },
  { label: "Building Designs Consultancy", code: "D" }
] as const;

export const HOD_SUB_TECHNICAL_UNIT_OPTIONS: Record<string, Array<{ label: string; code: string }>> = {
  T: [
    { label: "Geotechnical Exploration", code: "GE" },
    { label: "Laboratory Testing", code: "MT" },
    { label: "Load Testing Services (Bridge/Pile)", code: "LT" },
    { label: "Chemical Environment Testing", code: "CE" },
    { label: "NDT", code: "ND" }
  ],
  S: [
    { label: "Authority Engineer", code: "AE" },
    { label: "Independent Engineer", code: "IE" },
    { label: "Project Management Consultant", code: "PM" },
    { label: "Third Party Inspection", code: "TP" },
    { label: "Proof Checking", code: "PC" },
    { label: "Field Highway Testing", code: "FH" },
    { label: "Road Safety Audit", code: "RS" },
    { label: "Environment Audit", code: "EA" },
    { label: "Road Infrastructure Designs", code: "IR" },
    { label: "Bridge Infrastructure Designs", code: "IB" },
    { label: "Industrial Infrastructure & Park", code: "IS" },
    { label: "Marine Infrastructure", code: "MS" },
    { label: "Detail Design Infrastructure", code: "DD" },
    { label: "Hydro Engineering", code: "HE" },
    { label: "Tunnel Engineering", code: "TE" }
  ],
  D: [
    { label: "Architectural Design", code: "AR" },
    { label: "Structural Design", code: "ST" },
    { label: "BIM Services", code: "BM" },
    { label: "Utilities Design Services", code: "UD" },
    { label: "Quantity Survey & Estimation", code: "QS" },
    { label: "Energy Audit Services", code: "EN" },
    { label: "Green Building Services", code: "GB" },
    { label: "Building Infrastructure Designs", code: "BU" }
  ]
};

const HOD_COMPANY_CODES = new Set(HOD_COMPANY_OPTIONS.map((item) => item.code));
const HOD_TECHNICAL_UNIT_CODES = new Set(HOD_TECHNICAL_UNIT_OPTIONS.map((item) => item.code));

/** Parsed from assigned project number: [Company][TechUnit][SubUnit2][FY2][Serial2][WorkCat1] e.g. SDST2601R */
export function parseCodesFromProjectNumber(projectNumber?: string | null) {
  const number = projectNumber?.trim().toUpperCase();
  if (!number || number.length < 4) {
    return {
      companyCode: null as string | null,
      technicalUnitCode: null as string | null,
      subTechnicalUnitCode: null as string | null
    };
  }

  const companyCode = number.charAt(0);
  const technicalUnitCode = number.charAt(1);
  const subTechnicalUnitCode = number.slice(2, 4);

  if (!HOD_COMPANY_CODES.has(companyCode)) {
    return { companyCode: null, technicalUnitCode: null, subTechnicalUnitCode: null };
  }

  if (!HOD_TECHNICAL_UNIT_CODES.has(technicalUnitCode)) {
    return { companyCode, technicalUnitCode: null, subTechnicalUnitCode: null };
  }

  const subOptions = HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitCode] ?? [];
  const subOk = subOptions.some((item) => item.code === subTechnicalUnitCode);

  return {
    companyCode,
    technicalUnitCode,
    subTechnicalUnitCode: subOk ? subTechnicalUnitCode : null
  };
}

export function getProjectTechnicalUnitCode(
  project: Pick<ProjectItem, "technicalUnitCode" | "projectNumber">
): string | null {
  const stored = project.technicalUnitCode?.trim().toUpperCase();
  if (stored && HOD_TECHNICAL_UNIT_CODES.has(stored)) {
    return stored;
  }
  return parseCodesFromProjectNumber(project.projectNumber).technicalUnitCode;
}

export function getProjectSubTechnicalUnitCode(
  project: Pick<ProjectItem, "technicalUnitCode" | "subTechnicalUnitCode" | "projectNumber">
): string | null {
  const technicalUnitCode = getProjectTechnicalUnitCode(project);
  const stored = project.subTechnicalUnitCode?.trim().toUpperCase();
  if (stored && technicalUnitCode) {
    const options = HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitCode] ?? [];
    if (options.some((item) => item.code === stored)) {
      return stored;
    }
  }
  return parseCodesFromProjectNumber(project.projectNumber).subTechnicalUnitCode;
}

export function compareHodProjectsByNumber(
  a: Pick<ProjectItem, "name" | "projectNumber">,
  b: Pick<ProjectItem, "name" | "projectNumber">
) {
  const numberA = a.projectNumber?.trim() ?? "";
  const numberB = b.projectNumber?.trim() ?? "";
  const hasA = Boolean(numberA);
  const hasB = Boolean(numberB);

  if (hasA && !hasB) return -1;
  if (!hasA && hasB) return 1;
  if (!hasA && !hasB) {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  const byNumber = numberA.localeCompare(numberB, undefined, { numeric: true, sensitivity: "base" });
  if (byNumber !== 0) return byNumber;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Company initial is encoded as the first character of the assigned project number (e.g. GSAE2601R → G). */
export function getProjectCompanyCode(project: Pick<ProjectItem, "companyCode" | "projectNumber">): string | null {
  const stored = project.companyCode?.trim();
  if (stored && HOD_COMPANY_CODES.has(stored)) {
    return stored;
  }

  const initial = project.projectNumber?.trim().charAt(0).toUpperCase();
  if (initial && HOD_COMPANY_CODES.has(initial)) {
    return initial;
  }

  return stored || null;
}

export type HodTaskActivityStatus = "NOT_STARTED" | "TASK_PENDING" | "TASK_COMPLETED" | "APPROVED";

export type HodProjectLifecycle = "ONGOING" | "COMPLETED";

export function getTasksForProject(project: ProjectItem, tasks: TaskItem[]): TaskItem[] {
  const number = project.projectNumber?.trim();
  const name = project.name.trim();

  return tasks.filter((task) => {
    const taskNumber = task.projectNumber?.trim();
    const taskProject = task.project?.trim() ?? "";
    if (number && taskNumber && taskNumber === number) return true;
    if (number && taskProject === number) return true;
    if (taskProject === name) return true;
    return false;
  });
}

export function getHodTaskActivityStatus(task: TaskItem): HodTaskActivityStatus {
  if (task.reviewCompletedAt || task.status === "DONE") {
    return "APPROVED";
  }
  if (task.submittedForReviewAt || task.actualCompletedAt) {
    return "TASK_COMPLETED";
  }
  if (task.status === "TODO" || task.status === "IN_PROGRESS" || task.status === "BLOCKED") {
    return "TASK_PENDING";
  }
  return "NOT_STARTED";
}

export function getHodTaskActivityLabel(status: HodTaskActivityStatus): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "TASK_COMPLETED":
      return "Draft Submitted";
    case "TASK_PENDING":
      return "Under Preparation";
    default:
      return "Not Started";
  }
}

export function getHodTaskActivityDate(status: HodTaskActivityStatus, task: TaskItem): string | null {
  switch (status) {
    case "TASK_PENDING":
      return formatHodDate(task.allocatedAt ?? task.createdAt);
    case "TASK_COMPLETED":
      return formatHodDate(task.submittedForReviewAt ?? task.actualCompletedAt);
    case "APPROVED":
      return formatHodDate(task.reviewCompletedAt);
    default:
      return null;
  }
}

export function shouldShowHodActivityDate(status: HodTaskActivityStatus, date: string | null | undefined): date is string {
  return status !== "NOT_STARTED" && Boolean(date) && date !== "-";
}

export function getHodTaskActivityTone(status: HodTaskActivityStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500/15 text-emerald-600 border-emerald-500/25";
    case "TASK_COMPLETED":
      return "bg-sky-500/15 text-sky-600 border-sky-500/25";
    case "TASK_PENDING":
      return "bg-amber-500/15 text-amber-700 border-amber-500/25";
    default:
      return "bg-muted text-muted-foreground border-border/40";
  }
}

export function getProjectLifecycle(projectTasks: TaskItem[]): HodProjectLifecycle {
  if (projectTasks.length === 0) {
    return "ONGOING";
  }
  return projectTasks.every((task) => task.status === "DONE") ? "COMPLETED" : "ONGOING";
}

export function summarizeProjectTasks(projectTasks: TaskItem[]) {
  const summary = {
    total: projectTasks.length,
    pending: 0,
    completed: 0,
    approved: 0
  };

  for (const task of projectTasks) {
    const status = getHodTaskActivityStatus(task);
    if (status === "TASK_PENDING") summary.pending += 1;
    if (status === "TASK_COMPLETED") summary.completed += 1;
    if (status === "APPROVED") summary.approved += 1;
  }

  return summary;
}

export function formatHodDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatHodPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

export function formatHodCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCompanyLabel(code?: string | null) {
  if (!code) return "-";
  return HOD_COMPANY_OPTIONS.find((item) => item.code === code)?.label ?? code;
}

export function getTechnicalUnitLabel(code?: string | null) {
  if (!code) return "-";
  return HOD_TECHNICAL_UNIT_OPTIONS.find((item) => item.code === code)?.label ?? code;
}

export function getSubTechnicalUnitLabel(technicalUnitCode?: string | null, subCode?: string | null) {
  if (!technicalUnitCode || !subCode) return "-";
  const options = HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitCode] ?? [];
  return options.find((item) => item.code === subCode)?.label ?? subCode;
}
