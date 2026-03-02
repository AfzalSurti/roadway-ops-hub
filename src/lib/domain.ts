export type Role = "ADMIN" | "EMPLOYEE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type ReportStatus = "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

export type TemplateField = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "photo" | "file" | "textarea";
  required: boolean;
  options?: string[];
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  project: string;
  dueDate: string;
  status: TaskStatus;
  priority: Priority;
  blockedReason?: string | null;
  assignedToId: string;
  createdById: string;
  reportTemplateId: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: ApiUser;
  createdBy?: ApiUser;
  reportTemplate?: ReportTemplate;
};

export type ReportTemplate = {
  id: string;
  name: string;
  description?: string | null;
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
};

export type ReportItem = {
  id: string;
  taskId: string;
  reportTemplateId: string;
  submittedById: string;
  submission: Record<string, unknown>;
  templateSnapshot: TemplateField[];
  status: ReportStatus;
  adminFeedback?: string | null;
  createdAt: string;
  updatedAt: string;
  task?: TaskItem;
  submittedBy?: ApiUser;
  reportTemplate?: ReportTemplate;
  attachments?: Array<{ id: string; fileName: string; url: string }>;
};

export const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  TODO: { label: "To Do", color: "text-muted-foreground bg-muted" },
  IN_PROGRESS: { label: "In Progress", color: "text-primary bg-primary/10" },
  BLOCKED: { label: "Blocked", color: "text-warning bg-warning/10" },
  DONE: { label: "Done", color: "text-accent bg-accent/10" }
};

export const priorityConfig: Record<Priority, { label: string; color: string }> = {
  LOW: { label: "Low", color: "text-muted-foreground bg-muted" },
  MEDIUM: { label: "Medium", color: "text-primary bg-primary/10" },
  HIGH: { label: "High", color: "text-warning bg-warning/10" },
  URGENT: { label: "Urgent", color: "text-destructive bg-destructive/10" }
};

export const reportStatusConfig: Record<ReportStatus, { label: string; color: string }> = {
  SUBMITTED: { label: "Submitted", color: "text-warning bg-warning/10" },
  APPROVED: { label: "Approved", color: "text-accent bg-accent/10" },
  CHANGES_REQUESTED: { label: "Changes Requested", color: "text-primary bg-primary/10" },
  REJECTED: { label: "Rejected", color: "text-destructive bg-destructive/10" }
};

export const toAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0ea5e9`;