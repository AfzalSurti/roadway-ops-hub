export type Role = "ADMIN" | "PMO" | "HOD" | "INFRA" | "EMPLOYEE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type ReportStatus = "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
export type FinancialBillStatus = "PLANNING" | "PUT_UP" | "RECEIVED";
export type AssetStatus = "IN_USE" | "IN_STORE" | "UNDER_REPAIR" | "DISPOSED";
export type DprReportStatus = "NOT_STARTED" | "UNDER_PREPARATION" | "DRAFT_SUBMITTED" | "UNDER_APPROVAL" | "APPROVED";

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
};

export type CreateEmployeeResponse = {
  user: ApiUser;
  emailSent: boolean;
  message: string;
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
  woAmount?: string;
  woGstAmount?: string;
  woTotalAmount?: string;
  excessAmount?: string;
  excessGstAmount?: string;
  excessTotalAmount?: string;
  bgAmount?: string;
  bgIssueDate?: string | null;
  bgExpiryDate?: string | null;
  emdAmount?: string;
  emdIssueDate?: string | null;
  emdExpiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InfraTeamMemberItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  manpowerGroup: "Key Personnel" | "Sub Professional Staff" | "Support Staff";
  manpowerRole: string;
  monthlyCost?: number | null;
  currentProject?: string | null;
  mobilizedAt?: string | null;
  demobilizedAt?: string | null;
  notes?: string | null;
  projectAssignments?: Array<
    ProjectAssignmentItem & {
      project: Pick<ProjectItem, "id" | "name" | "projectNumber">;
    }
  >;
  createdAt: string;
  updatedAt: string;
};

export type ProjectAssignmentItem = {
  id: string;
  projectId: string;
  teamMemberId: string;
  mobilizedAt?: string | null;
  demobilizedAt?: string | null;
  daysWorked?: number | null;
  /** Estimated from monthlyCost/30 * days */
  amount?: number;
  estimatedAmount?: number;
  /** Amount actually paid to employee */
  actualAmount?: number | null;
  /** Amount drawn from government/client */
  drawnAmount?: number | null;
  profitLoss?: number;
  createdAt: string;
  updatedAt: string;
  teamMember?: InfraTeamMemberItem;
};

export type InfraOtherCostItem = {
  id: string;
  projectId: string;
  description: string;
  actualAmount?: number | null;
  drawnAmount?: number | null;
  profitLoss?: number;
  createdAt: string;
  updatedAt: string;
};

export type InfraProjectItem = ProjectItem & {
  subTechnicalUnitCode?: string | null;
  lifecycle: "ONGOING" | "COMPLETED";
  activeAssignments: number;
  /** Estimated staff cost (legacy) */
  totalCost?: number;
  staffEstimatedTotal?: number;
  staffActualTotal?: number;
  staffDrawnTotal?: number;
  otherActualTotal?: number;
  otherDrawnTotal?: number;
  totalActualAmount?: number;
  totalDrawnAmount?: number;
  totalProfitLoss?: number;
  infraOtherCosts?: InfraOtherCostItem[];
  assignments: Array<ProjectAssignmentItem & { teamMember: InfraTeamMemberItem }>;
};

export type InfraOverviewItem = {
  totalProjects: number;
  ongoingProjects: number;
  completedProjects: number;
  byUnit: Array<{ code: string; count: number }>;
  teamMembers: number;
  mobilizedTeamMembers: number;
  totalStaffCost?: number;
  totalActualAmount?: number;
  totalDrawnAmount?: number;
  totalProfitLoss?: number;
};

export type LetterCategory = "INWARD" | "OUTWARD" | "OTHER";

export type LetterProjectItem = {
  id: string;
  projectNumber: string;
  projectCode: string;
  shortName: string;
  fullName: string;
  projectCoordinator: string;
  projectEngineer: string;
  linkedProjectId?: string | null;
  linkedProject?: Pick<ProjectItem, "id" | "name" | "projectNumber"> | null;
  _count?: { letters: number };
  letters?: LetterEntryItem[];
  createdAt: string;
  updatedAt: string;
};

export type LetterEntryItem = {
  id: string;
  letterProjectId: string;
  sortOrder: number;
  serialLabel: string;
  letterDate?: string | null;
  letterNumber: string;
  category: LetterCategory;
  sentBy: string;
  sentTo: string;
  subject: string;
  ccTo: string;
  subjectCategory: string;
  letterLinkUrl?: string | null;
  outwardSequence?: string | null;
  /** Inward/Other: whether a reply is required */
  needsReply?: boolean | null;
  /** When reply was marked done */
  repliedAt?: string | null;
  /** Serial this letter replies to (e.g. "2a") */
  replyOfSerial?: string | null;
  /** Optional remark */
  remark?: string;
  createdAt: string;
  updatedAt: string;
};

export type LetterPendingReplyItem = LetterEntryItem & {
  letterProject: {
    id: string;
    projectNumber: string;
    projectCode: string;
    shortName: string;
  };
};

export type ProjectDprOverviewItem = {
  id: string;
  projectId: string;
  status: DprReportStatus;
  data?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetMovementItem = {
  id: string;
  assetId: string;
  previousProjectNumber?: string | null;
  previousProjectName?: string | null;
  previousAssignedDate?: string | null;
  previousUser?: string | null;
  movedToProjectNumber?: string | null;
  movedToProjectName?: string | null;
  assignedDate?: string | null;
  returnDate?: string | null;
  dateOfMoving: string;
  movedToUser?: string | null;
  createdAt: string;
};

export type AssetMaintenanceItem = {
  id: string;
  assetId: string;
  dateOfMaintenance: string;
  repairCostInclGst: number;
  depreciationTillDate: number;
  projectNumber?: string | null;
  projectName?: string | null;
  remark?: string | null;
  createdAt: string;
};

export type AssetItem = {
  id: string;
  assetId: string;
  itAssetId?: string | null;
  assetClass: string;
  assetType: string;
  markModel?: string | null;
  dateOfPurchase?: string | null;
  warrantyPeriod?: string | null;
  purchaseAmount: number;
  gst: number;
  totalAmountWithGst: number;
  usefulLifeYears: number;
  scrapRate: number;
  scrapValue: number;
  depreciationPerYear: number;
  depreciationPerMonth?: number;
  monthsElapsed?: number;
  yearsElapsed: number;
  currentValue: number;
  depreciationAsOfYear: number;
  projectNumber?: string | null;
  projectName?: string | null;
  assignedUser?: string | null;
  assignedDate?: string | null;
  status: AssetStatus;
  soldAmount?: number;
  soldRemark?: string | null;
  remarks?: string | null;
  forMonth?: string | null;
  billFileUrl?: string | null;
  billFileName?: string | null;
  billMimeType?: string | null;
  createdAt: string;
  updatedAt: string;
  movements?: AssetMovementItem[];
  maintenances?: AssetMaintenanceItem[];
};

export type AssetStatsResponse = {
  totalAssets: number;
  totalAssetValue: number;
  projectsWithAssets: number;
  assetsWithProjectNumber: number;
  statusCounts: Partial<Record<AssetStatus, number>>;
  assetClassCounts: Record<string, { count: number; group: string }>;
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
  totalAmount: string;
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

export type AssistantConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantDraft = {
  action: string;
  arguments?: Record<string, unknown>;
  missingFields?: string[];
};

export type AssistantChatResponse = {
  status: "completed" | "needs_input" | "failed";
  action: string;
  reply: string;
  missingFields?: string[];
  result?: unknown;
  generatedCredentials?: {
    email: string;
    password: string;
  };
  draft?: AssistantDraft;
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

export type FinancialCarryForwardBillRef = {
  id: string;
  billName: string;
  status: FinancialBillStatus;
  planningType: "NORMAL" | "EXCESS";
  totalAmount: number;
  totalReceivedAmount: number;
  receivedDate?: string | null;
};

export type FinancialCarryForward = {
  id: string;
  sourceRaBillId: string;
  targetRaBillId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  sourceRaBill?: FinancialCarryForwardBillRef;
  targetRaBill?: FinancialCarryForwardBillRef;
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
  outgoingCarryForwards: FinancialCarryForward[];
  incomingCarryForwards: FinancialCarryForward[];
};

export type FinancialProjectSummary = {
  id: string;
  name: string;
  projectNumber: string;
  requisitionFormId: string;
  workOrderNumber?: string;
  workOrderDate?: string | null;
  billingName?: string;
  designation?: string;
  department?: string;
  addressWithPincode?: string;
  nameOfWork?: string;
  panTanNumber?: string;
  gstNumber?: string;
  contractValue: number;
  taxAmount: number;
  totalAmount: number;
  excessAmount?: string;
  excessGstAmount?: string;
  excessTotalAmount?: string;
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

export type FinancialProjectBillStatusRow = {
  projectId: string;
  folderNo: string;
  dprProject: string;
  projectNo: string;
  workOrderAmountExclGst: number;
  receivedAmountExclGst: number;
  financialProgressPct: number;
  raBillRaisedClaim: number;
  planningAmount: number;
  totalExcessExclGst: number;
  excessReceived: number;
  excessBillRaisedClaim: number;
  remark: string;
};

export type FinancialAllProjectsBillStatusSummary = {
  generatedAt: string;
  rows: FinancialProjectBillStatusRow[];
  missingColumns: string[];
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

export const dprReportStatusConfig: Record<DprReportStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", color: "text-muted-foreground bg-muted" },
  UNDER_PREPARATION: { label: "Under Preparation", color: "text-primary bg-primary/10" },
  DRAFT_SUBMITTED: { label: "Draft Submitted", color: "text-warning bg-warning/10" },
  UNDER_APPROVAL: { label: "Under Approval", color: "text-indigo-400 bg-indigo-400/10" },
  APPROVED: { label: "Approved", color: "text-accent bg-accent/10" }
};

export const toAvatarUrl = (name: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0ea5e9`;

export const isTaskOverdue = (task: Pick<TaskItem, "dueDate" | "status">) =>
  new Date(task.dueDate) < new Date() && task.status !== "DONE" && task.status !== "IN_PROGRESS";

export type ExpenseSheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type ExpenseCategoryItem = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type ExpenseEntryItem = {
  id: string;
  expenseSheetId: string;
  categoryId: string;
  entryDate: string;
  amount: number;
  description: string;
  billAvailable: boolean;
  billNumber?: string | null;
  billAttachmentUrl?: string | null;
  category?: ExpenseCategoryItem;
  voucher?: { id: string; voucherNumber: string; generatedAt: string } | null;
};

export type ExpenseApprovalItem = {
  id: string;
  expenseSheetId: string;
  reviewerId: string;
  status: ExpenseSheetStatus;
  comments?: string | null;
  reviewedAt: string;
  reviewer?: { id: string; name: string; email: string };
};

export type ExpenseSheetItem = {
  id: string;
  employeeId: string;
  projectId?: string | null;
  employeeDisplayName?: string | null;
  siteName: string;
  siteIncharge: string;
  totalPersons: number;
  expenseDate: string;
  mobileNumber?: string | null;
  bankAccount?: string | null;
  sheetNumber?: number | null;
  status: ExpenseSheetStatus;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; name: string; email: string; contactNumber?: string | null };
  project?: { id: string; name: string; projectNumber?: string | null } | null;
  entries: ExpenseEntryItem[];
  approvals?: ExpenseApprovalItem[];
  totalAmount?: number;
  employeeName?: string;
  employeeEmail?: string;
  projectName?: string | null;
  projectNumber?: string | null;
  latestApproval?: ExpenseApprovalItem | null;
};

export type ExpenseEmployeeCategoryAnalytics = {
  employees: Array<{ id: string; name: string }>;
  selectedEmployeeId: string | null;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    total: number;
    breakdown: Array<{ label: string; amount: number }>;
  }>;
  totalAmount: number;
};

export type ExpenseDashboardStats = {
  totalExpensesThisMonth: number;
  totalExpensesToday: number;
  totalExpensesAllTime: number;
  totalExpenseSheets: number;
  totalExpenseEntries: number;
  employeesWithExpenses: number;
  totalVoucherEntries: number;
  expenseByCategory: Array<{ categoryId: string; categoryName: string; total: number }>;
  monthlyExpenseTrend: Array<{ month: string; total: number }>;
  expenseByEmployee: Array<{ employeeId: string; employeeName: string; total: number }>;
  recentSheets: ExpenseSheetItem[];
};

export type ExpenseVoucherItem = {
  id: string;
  voucherNumber: string;
  generatedAt: string;
  date: string;
  employeeName: string;
  projectName: string;
  projectNumber?: string | null;
  expenseCategory: string;
  description: string;
  amount: number;
  approvalStatus: ExpenseSheetStatus;
};

export const expenseSheetStatusConfig: Record<ExpenseSheetStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  SUBMITTED: { label: "Submitted", className: "bg-amber-500/15 text-amber-700" },
  APPROVED: { label: "Approved", className: "bg-emerald-500/15 text-emerald-600" },
  REJECTED: { label: "Rejected", className: "bg-rose-500/15 text-rose-600" }
};