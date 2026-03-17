export type Role = "ADMIN" | "EMPLOYEE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type ReportStatus = "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
export type FinancialBillStatus = "PLANNING" | "PUT_UP" | "RECEIVED";

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
  contactNumber?: string | null;
  education?: string | null;
  yearOfPassing?: string | null;
  totalExperience?: string | null;
  dateOfJoining?: string | null;
  experienceInOrg?: string | null;
  currentCtc?: string | null;
};

export type ProjectItem = {
  id: string;
  name: string;
  description?: string | null;
  projectNumber?: string | null;
  projectCodePrefix?: string | null;
  companyCode?: string | null;
  technicalUnitCode?: string | null;
  subTechnicalUnitCode?: string | null;
  workCategoryCode?: string | null;
  financialYearShort?: number | null;
  serialNumber?: number | null;
  projectNumberAssignedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRequisitionFormItem = {
  id: string;
  projectId: string;
  costCentreDepartment: string;
  hodDirectorName: string;
  applicationDate: string;
  clientName: string;
  billingName: string;
  addressWithPincode: string;
  pincode: string;
  gstNumber: string;
  gstType: "REGISTERED" | "UNREGISTERED";
  contactName: string;
  contactNumber: string;
  designation: string;
  department: string;
  panTanNumber: string;
  email: string;
  workOrderValue: string;
  workOrderDate?: string | null;
  agreementNumber?: string | null;
  agreementDate?: string | null;
  projectStartingDate: string;
  projectDurationDays: number;
  projectCompletionDate: string;
  workOrderNumber: string;
  newProjectNumber: string;
  amountOfWorkOrder: string;
  gstAmount: string;
  emdAmount: string;
  pgSdAmount: string;
  pgDate?: string | null;
  pgExpiryDate?: string | null;
  nameOfWork: string;
  locationDistrict: string;
  state: string;
  approvedProjectNumber: string;
  approvedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  projectCode?: string | null;
  projectNumber?: string | null;
  project: string;
  dueDate: string;
  allocatedAt?: string;
  allottedDays?: number | null;
  submittedForReviewAt?: string | null;
  managerReviewComments?: string | null;
  reviewCompletedAt?: string | null;
  actualCompletedAt?: string | null;
  completionDays?: number | null;
  completionDelayDays?: number | null;
  rating?: number | null;
  ratingEnabled?: boolean;
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
  submittedAt?: string;
  turnaroundDays?: number | null;
  createdAt: string;
  updatedAt: string;
  task?: TaskItem;
  submittedBy?: ApiUser;
  reportTemplate?: ReportTemplate;
  attachments?: Array<{ id: string; fileName: string; url: string }>;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: ApiUser;
};

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
};

export type FinancialPlanItem = {
  id: string;
  planId: string;
  itemNumber: number;
  planningType: "NORMAL" | "EXCESS";
  particulars: string;
  percentage: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

export type FinancialBillItem = {
  id: string;
  planId: string;
  raBillId: string;
  itemId: string;
  billPercentage: number;
  billAmount: number;
  taxAmount: number;
  totalAmount: number;
  carryForwardAmount: number;
  status: FinancialBillStatus;
  receivedPercentage: number;
  receivedAmount: number;
  receivedDate?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: FinancialPlanItem;
};

export type FinancialRaBill = {
  id: string;
  planId: string;
  planningType: "NORMAL" | "EXCESS";
  billName: string;
  status: FinancialBillStatus;
  totalBillAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  receivedDate?: string | null;
  chequeRtgsAmount: number;
  itDeductionPct: number;
  itDeductionAmount: number;
  lCessDeductionPct: number;
  lCessDeductionAmount: number;
  securityDepositPct: number;
  securityDepositAmount: number;
  recoverFromRaBillPct: number;
  recoverFromRaBillAmount: number;
  gstWithheldPct: number;
  gstWithheldAmount: number;
  withheldPct: number;
  withheldAmount: number;
  totalReceivedAmount: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  items: FinancialBillItem[];
};

export type FinancialProjectSummary = {
  id: string;
  name: string;
  projectNumber: string;
  requisitionFormId: string;
  contractValue: number;
  taxAmount: number;
  totalAmount: number;
};

export type FinancialItemTemplate = {
  itemNumber: number;
  particulars: string;
};

export type FinancialPlan = {
  id: string;
  projectId: string;
  contractValue: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  project?: ProjectItem;
  items: FinancialPlanItem[];
  raBills: FinancialRaBill[];
};

export type FinancialProjectDetail = {
  project: FinancialProjectSummary;
  itemTemplates: FinancialItemTemplate[];
  plan: FinancialPlan | null;
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

export const financialBillStatusConfig: Record<FinancialBillStatus, { label: string; color: string }> = {
  PLANNING: { label: "Planning", color: "text-muted-foreground bg-muted" },
  PUT_UP: { label: "Put Up", color: "text-primary bg-primary/10" },
  RECEIVED: { label: "Received", color: "text-accent bg-accent/10" }
};

export const toAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0ea5e9`;

export const isTaskOverdue = (task: Pick<TaskItem, "dueDate" | "status">) =>
  new Date(task.dueDate) < new Date() && task.status !== "DONE" && task.status !== "IN_PROGRESS";