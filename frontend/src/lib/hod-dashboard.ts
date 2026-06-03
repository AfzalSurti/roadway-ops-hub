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
      return "Task Completed";
    case "TASK_PENDING":
      return "Task Pending";
    default:
      return "Not Started";
  }
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
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
