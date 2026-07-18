import type {
  ApiUser,
  AppNotification,
  AssetItem,
  AssetMaintenanceItem,
  AssetMovementItem,
  AssetStatsResponse,
  AssetStatus,
  AssistantChatResponse,
  AssistantConversationMessage,
  AssistantDraft,
  CreateEmployeeResponse,
  DprReportStatus,
  ExpenseCategoryItem,
  ExpenseDashboardStats,
  ExpenseEmployeeCategoryAnalytics,
  ExpenseEntryItem,
  ExpenseSheetItem,
  ExpenseSheetStatus,
  ExpenseVoucherItem,
  FinancialAllProjectsBillStatusSummary,
  FinancialBillItem,
  FinancialBillStatus,
  FinancialPlan,
  FinancialProjectDetail,
  FinancialProjectSummary,
  FinancialRaBill,
  ProjectDprOverviewItem,
  InfraOtherCostItem,
  InfraOverviewItem,
  InfraProjectItem,
  InfraTeamMemberItem,
  LetterCategory,
  LetterEntryItem,
  LetterProjectItem,
  ProjectItem,
  ProjectRequisitionFormItem,
  ReportItem,
  ReportStatus,
  ReportTemplate,
  TaskComment,
  TaskItem,
  TaskStatus
} from "./domain";

  const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

class RefreshSessionError extends Error {
  requiresLogout: boolean;

  constructor(message: string, requiresLogout: boolean) {
    super(message);
    this.requiresLogout = requiresLogout;
  }
}

function shouldLogoutForRefreshError(error: unknown): boolean {
  return error instanceof RefreshSessionError && error.requiresLogout;
}

function buildErrorMessage<T>(response: Response, json: ApiResponse<T>): string {
  const fallbackMessage = json.error?.message ?? `Request failed (${response.status})`;
  const details = json.error?.details as
    | {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      }
    | undefined;

  if (!details) {
    return fallbackMessage;
  }

  const fieldMessages = Object.entries(details.fieldErrors ?? {})
    .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`))
    .filter(Boolean);

  const formMessages = (details.formErrors ?? []).filter(Boolean);
  const combined = [...fieldMessages, ...formMessages];

  return combined.length ? combined.join(" | ") : fallbackMessage;
}

const ACCESS_TOKEN_KEY = "highwayops_access_token";
const REFRESH_TOKEN_KEY = "highwayops_refresh_token";
const USER_KEY = "highwayops_user";
const AUTH_CHANGED_EVENT = "highwayops-auth-changed";

function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export const authStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: (): ApiUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  },
  setSession(args: { accessToken: string; refreshToken: string; user: ApiUser }) {
    localStorage.setItem(ACCESS_TOKEN_KEY, args.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, args.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(args.user));
    emitAuthChanged();
  },
  setAccessToken(accessToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    emitAuthChanged();
  },
  setUser(user: ApiUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    emitAuthChanged();
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    emitAuthChanged();
  }
};

let refreshPromise: Promise<string> | null = null;

async function fetchWithApiFallback(path: string, init: RequestInit) {
  let response = await fetch(`${API_BASE_URL}${path}`, init);
  if (response.status === 404 && !path.startsWith("/api/")) {
    response = await fetch(`${API_BASE_URL}/api${path}`, init);
  }
  return response;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) {
    throw new RefreshSessionError("Session expired. Please login again.", true);
  }

  let response: Response;
  try {
    response = await fetchWithApiFallback("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    });
  } catch {
    throw new RefreshSessionError("Unable to refresh session right now. Please try again.", false);
  }

  let json: ApiResponse<{ accessToken: string }>;
  try {
    json = (await response.json()) as ApiResponse<{ accessToken: string }>;
  } catch {
    throw new RefreshSessionError("Unable to refresh session right now. Please try again.", false);
  }

  if (!response.ok || !json.success || !json.data?.accessToken) {
    const message = json.error?.message ?? "Unable to refresh session right now. Please try again.";
    const authFailure =
      response.status === 401 ||
      response.status === 403 ||
      /refresh token is invalid|invalid or expired refresh token|refresh token/i.test(message);

    throw new RefreshSessionError(
      authFailure ? "Session expired. Please login again." : message,
      authFailure
    );
  }

  authStorage.setAccessToken(json.data.accessToken);
  return json.data.accessToken;
}

export async function bootstrapSession(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  const user = authStorage.getUser();
  if (!refreshToken || !user) {
    authStorage.clear();
    return false;
  }

  try {
    await refreshAccessToken();
    return true;
  } catch (error) {
    if (shouldLogoutForRefreshError(error)) {
      authStorage.clear();
      return false;
    }

    // Keep session for transient refresh failures (network/cold-start).
    return true;
  }
}

export function subscribeAuthChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
}

async function request<T>(path: string, init: RequestInit = {}, useAuth = true, retryOnUnauthorized = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (useAuth) {
    const token = authStorage.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const doFetch = (targetPath: string) =>
    fetch(`${API_BASE_URL}${targetPath}`, {
      ...init,
      headers
    });

  let response = await doFetch(path);

  // Some deployments expose routes under /api. Retry once on 404.
  if (response.status === 404 && !path.startsWith("/api/")) {
    response = await doFetch(`/api${path}`);
  }

  if (response.status === 401 && useAuth && retryOnUnauthorized) {
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return request<T>(path, init, useAuth, false);
    } catch (error) {
      if (shouldLogoutForRefreshError(error)) {
        authStorage.clear();
        throw new Error("Invalid or expired access token. Please login again.");
      }

      throw new Error("Unable to refresh session right now. Please try again.");
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(buildErrorMessage(response, json));
  }

  return json.data;
}

export const api = {
  async login(email: string, password: string) {
    const data = await request<{ accessToken: string; refreshToken: string; user: ApiUser }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password })
      },
      false
    );

    authStorage.setSession(data);
    return data;
  },

  async logout() {
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      await request(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken })
        },
        false
      ).catch(() => undefined);
    }
    authStorage.clear();
  },

  getTasks(params?: { page?: number; limit?: number; search?: string; status?: TaskStatus; assignedToId?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.assignedToId) query.set("assignedToId", params.assignedToId);
    return request<{ items: TaskItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/tasks${query.toString() ? `?${query.toString()}` : ""}`
    );
  },

  getTask(id: string) {
    return request<TaskItem>(`/tasks/${id}`);
  },

  createTask(payload: {
    title: string;
    description?: string;
    projectCode?: string;
    projectNumber?: string;
    project: string;
    allocatedAt: string;
    allottedDays?: number;
    ratingEnabled?: boolean;
    assignedToId: string;
    reportTemplateId?: string;
  }) {
    return request<TaskItem>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateTask(id: string, payload: Partial<Pick<TaskItem, "status" | "blockedReason" | "title" | "description" | "project" | "priority" | "assignedToId" | "reportTemplateId">>) {
    return request<TaskItem>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  completeTask(id: string, note?: string) {
    return request<TaskItem>(`/tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ note })
    });
  },

  approveTask(id: string) {
    return request<TaskItem>(`/tasks/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  requestTaskChanges(id: string, body: string) {
    return request<TaskItem>(`/tasks/${id}/request-changes`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  },

  acknowledgeTaskComment(id: string) {
    return request<{ acknowledged: boolean }>(`/tasks/${id}/comment-ack`, {
      method: "POST",
      body: JSON.stringify({})
    });
  },

  getTaskComments(taskId: string) {
    return request<TaskComment[]>(`/tasks/${taskId}/comments`);
  },

  addTaskComment(taskId: string, body: string) {
    return request<TaskComment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  },

  getTemplates() {
    return request<ReportTemplate[]>("/templates");
  },

  createTemplate(payload: { name: string; description?: string; fields: ReportTemplate["fields"] }) {
    return request<ReportTemplate>("/templates", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getReports(params?: { page?: number; limit?: number; status?: ReportStatus }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    return request<{ items: ReportItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/reports${query.toString() ? `?${query.toString()}` : ""}`
    );
  },

  updateReportStatus(id: string, status: Exclude<ReportStatus, "SUBMITTED">) {
    return request<ReportItem>(`/reports/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  updateReportFeedback(id: string, adminFeedback: string) {
    return request<ReportItem>(`/reports/${id}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ adminFeedback })
    });
  },

  submitReport(payload: { taskId: string; reportTemplateId: string; submission: Record<string, unknown> }) {
    return request<ReportItem>("/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getUsers() {
    return request<ApiUser[]>("/users");
  },

  getProjects() {
    return request<ProjectItem[]>("/projects");
  },

  getInfraOverview() {
    return request<InfraOverviewItem>("/infra/overview");
  },

  getInfraProjects() {
    return request<InfraProjectItem[]>("/infra/projects");
  },

  getInfraProject(id: string) {
    return request<InfraProjectItem>(`/infra/projects/${id}`);
  },

  getInfraTeamMembers() {
    return request<InfraTeamMemberItem[]>("/infra/team");
  },

  createInfraTeamMember(payload: {
    name: string;
    email?: string | null;
    phone?: string | null;
    manpowerGroup: "Key Personnel" | "Sub Professional Staff" | "Support Staff";
    manpowerRole: string;
    monthlyCost?: number | null;
    notes?: string | null;
  }) {
    return request<InfraTeamMemberItem>("/infra/team", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateInfraTeamMember(
    id: string,
    payload: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      manpowerGroup: "Key Personnel" | "Sub Professional Staff" | "Support Staff";
      manpowerRole: string;
      monthlyCost: number | null;
      notes: string | null;
    }>
  ) {
    return request<InfraTeamMemberItem>(`/infra/team/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteInfraTeamMember(id: string) {
    return request<{ deleted: boolean }>(`/infra/team/${id}`, {
      method: "DELETE"
    });
  },

  assignInfraProject(
    projectId: string,
    payload: {
      teamMemberId?: string;
      teamMemberIds?: string[];
      mode?: "assign" | "mobilize";
      mobilizedAt?: string | null;
      daysWorked?: number | null;
    }
  ) {
    return request(`/infra/projects/${projectId}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateInfraProjectAssignment(
    projectId: string,
    assignmentId: string,
    payload: {
      mobilizedAt?: string | null;
      demobilizedAt?: string | null;
      daysWorked?: number | null;
      actualAmount?: number | null;
      drawnAmount?: number | null;
    }
  ) {
    return request(`/infra/projects/${projectId}/assignments/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  createInfraOtherCost(
    projectId: string,
    payload: { description: string; actualAmount?: number | null; drawnAmount?: number | null }
  ) {
    return request<InfraOtherCostItem>(`/infra/projects/${projectId}/other-costs`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateInfraOtherCost(
    projectId: string,
    costId: string,
    payload: Partial<{ description: string; actualAmount: number | null; drawnAmount: number | null }>
  ) {
    return request<InfraOtherCostItem>(`/infra/projects/${projectId}/other-costs/${costId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteInfraOtherCost(projectId: string, costId: string) {
    return request<{ deleted: boolean }>(`/infra/projects/${projectId}/other-costs/${costId}`, {
      method: "DELETE"
    });
  },

  getLetterProjects() {
    return request<LetterProjectItem[]>("/letter-numbering/projects");
  },

  getLetterProject(id: string) {
    return request<LetterProjectItem>(`/letter-numbering/projects/${id}`);
  },

  getLetterMainProjects() {
    return request<Array<Pick<ProjectItem, "id" | "name" | "description" | "projectNumber">>>(
      "/letter-numbering/main-projects"
    );
  },

  createLetterProject(payload: {
    projectNumber: string;
    projectCode: string;
    shortName: string;
    fullName?: string;
    projectCoordinator?: string;
    projectEngineer?: string;
    linkedProjectId?: string | null;
    syncToMainProject?: boolean;
  }) {
    return request<LetterProjectItem>("/letter-numbering/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  importLetterProject(payload: {
    mainProjectId: string;
    projectNumber?: string;
    projectCode?: string;
    shortName?: string;
    fullName?: string;
    projectCoordinator?: string;
    projectEngineer?: string;
  }) {
    return request<LetterProjectItem>("/letter-numbering/projects/import", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  syncLetterProjectToMain(id: string) {
    return request<LetterProjectItem>(`/letter-numbering/projects/${id}/sync-to-main`, {
      method: "POST"
    });
  },

  updateLetterProject(
    id: string,
    payload: Partial<{
      projectNumber: string;
      projectCode: string;
      shortName: string;
      fullName: string;
      projectCoordinator: string;
      projectEngineer: string;
    }>
  ) {
    return request<LetterProjectItem>(`/letter-numbering/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteLetterProject(id: string) {
    return request<{ deleted: boolean }>(`/letter-numbering/projects/${id}`, { method: "DELETE" });
  },

  getLetterEntries(letterProjectId: string) {
    return request<LetterEntryItem[]>(`/letter-numbering/projects/${letterProjectId}/letters`);
  },

  createLetterEntry(
    letterProjectId: string,
    payload: {
      category: LetterCategory;
      letterDate?: string | null;
      sentBy?: string;
      sentTo?: string;
      subject?: string;
      ccTo?: string;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
    }
  ) {
    return request<LetterEntryItem>(`/letter-numbering/projects/${letterProjectId}/letters`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  insertLetterEntry(
    letterProjectId: string,
    payload: {
      afterLetterId: string;
      category: LetterCategory;
      letterDate?: string | null;
      sentBy?: string;
      sentTo?: string;
      subject?: string;
      ccTo?: string;
      subjectCategory?: string;
      letterLinkUrl?: string | null;
      needsReply?: boolean | null;
      replied?: boolean;
    }
  ) {
    return request<LetterEntryItem>(`/letter-numbering/projects/${letterProjectId}/letters/insert`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateLetterEntry(
    letterId: string,
    payload: Partial<{
      category: LetterCategory;
      letterDate: string | null;
      sentBy: string;
      sentTo: string;
      subject: string;
      ccTo: string;
      subjectCategory: string;
      letterLinkUrl: string | null;
      needsReply: boolean | null;
      replied: boolean;
    }>
  ) {
    return request<LetterEntryItem>(`/letter-numbering/letters/${letterId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteLetterEntry(letterId: string) {
    return request<{ deleted: boolean }>(`/letter-numbering/letters/${letterId}`, { method: "DELETE" });
  },

  getLetterSuggestions(args: {
    field: "sentBy" | "sentTo" | "subject" | "ccTo";
    q?: string;
    letterProjectId?: string;
  }) {
    const params = new URLSearchParams({ field: args.field });
    if (args.q) params.set("q", args.q);
    if (args.letterProjectId) params.set("letterProjectId", args.letterProjectId);
    return request<string[]>(`/letter-numbering/suggestions?${params.toString()}`);
  },

  getProjectRequisitionForms() {
    return request<ProjectRequisitionFormItem[]>("/project-requisition-forms");
  },

  getProjectRequisitionForm(projectId: string) {
    return request<ProjectRequisitionFormItem>(`/project-requisition-forms/${projectId}`);
  },

  upsertProjectRequisitionForm(
    projectId: string,
    payload: Omit<ProjectRequisitionFormItem, "id" | "projectId" | "createdAt" | "updatedAt">
  ) {
    return request<ProjectRequisitionFormItem>(`/project-requisition-forms/${projectId}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  bulkImportProjects(
    rows: Array<{
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
      gstType?: "REGISTERED" | "UNREGISTERED";
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
      totalAmount?: string;
      emdAmount?: string | null;
      pgSdAmount?: string | null;
      pgDate?: string | null;
      pgExpiryDate?: string | null;
      nameOfWork: string;
      locationDistrict?: string | null;
      state?: string | null;
      approvedProjectNumber: string;
      approvedBy: string;
    }>
  ) {
    return request<{
      createdCount: number;
      failedCount: number;
      created: Array<{ row: number; projectId: string; projectNumber: string; action: "created" | "updated" }>;
      errors: Array<{ row: number; message: string }>;
    }>("/projects/import", {
      method: "POST",
      body: JSON.stringify({ rows })
    });
  },

  getProjectsWithoutNumber() {
    return request<ProjectItem[]>("/projects/without-number");
  },

  getProjectDprOverviews() {
    return request<ProjectDprOverviewItem[]>("/dpr-overviews");
  },

  getProjectDprOverview(projectId: string) {
    return request<ProjectDprOverviewItem | null>(`/dpr-overviews/project/${projectId}`);
  },

  getProjectDprOverviewByProject(projectId: string) {
    return request<ProjectDprOverviewItem | null>(`/dpr-overviews/project/${projectId}`);
  },

  createProjectDprOverview(payload: { projectId: string; status?: DprReportStatus; data?: Record<string, unknown> | null }) {
    return request<ProjectDprOverviewItem>("/dpr-overviews", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateProjectDprOverview(id: string, payload: Partial<{ status: DprReportStatus; data: Record<string, unknown> | null }>) {
    return request<ProjectDprOverviewItem>(`/dpr-overviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteProjectDprOverview(id: string) {
    return request<{ deleted: boolean }>(`/dpr-overviews/${id}`, {
      method: "DELETE"
    });
  },

  getAssets(params?: { page?: number; limit?: number; search?: string; assetClass?: string; projectNumber?: string; status?: AssetStatus }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);
    if (params?.assetClass) query.set("assetClass", params.assetClass);
    if (params?.projectNumber) query.set("projectNumber", params.projectNumber);
    if (params?.status) query.set("status", params.status);
    return request<{ items: AssetItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/assets${query.toString() ? `?${query.toString()}` : ""}`
    );
  },

  getAsset(id: string) {
    return request<AssetItem>(`/assets/${id}`);
  },

  createAsset(payload: {
    assetClass: string;
    assetType: string;
    markModel?: string | null;
    dateOfPurchase?: string | null;
    warrantyPeriod?: string | null;
    purchaseAmount?: number;
    gst?: number;
    projectNumber?: string | null;
    projectName?: string | null;
    assignedUser?: string | null;
    assignedDate?: string | null;
    status?: AssetStatus;
    soldAmount?: number | null;
    soldRemark?: string | null;
    remarks?: string | null;
    forMonth?: string | null;
    itAssetId?: string | null;
    billFileUrl?: string | null;
    billFileName?: string | null;
    billMimeType?: string | null;
  }) {
    return request<AssetItem>("/assets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  bulkImportAssets(
    rows: Array<{
      assetClass: string;
      assetType: string;
      markModel?: string | null;
      dateOfPurchase?: string | null;
      warrantyPeriod?: string | null;
      purchaseAmount?: number;
      gst?: number;
      projectNumber?: string | null;
      projectName?: string | null;
      assignedUser?: string | null;
      assignedDate?: string | null;
      status?: AssetStatus;
      soldAmount?: number | null;
      soldRemark?: string | null;
      remarks?: string | null;
      forMonth?: string | null;
      itAssetId?: string | null;
    }>
  ) {
    return request<{
      createdCount: number;
      failedCount: number;
      created: Array<{ row: number; assetId: string; id: string }>;
      errors: Array<{ row: number; message: string }>;
    }>("/assets/import", {
      method: "POST",
      body: JSON.stringify({ rows })
    });
  },

  updateAsset(id: string, payload: Partial<{
    assetClass: string;
    assetType: string;
    markModel: string | null;
    dateOfPurchase: string | null;
    warrantyPeriod: string | null;
    purchaseAmount: number;
    gst: number;
    projectNumber: string | null;
    projectName: string | null;
    assignedUser: string | null;
    assignedDate: string | null;
    status: AssetStatus;
    soldAmount: number | null;
    soldRemark: string | null;
    remarks: string | null;
    forMonth: string | null;
    itAssetId: string | null;
    billFileUrl: string | null;
    billFileName: string | null;
    billMimeType: string | null;
  }>) {
    return request<AssetItem>(`/assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const uploadOnce = async (path: string, retryOnUnauthorized = true): Promise<{
      attachmentId: string;
      url: string;
      meta: { fileName: string; originalName: string; mimeType: string; size: number };
    }> => {
      const headers = new Headers();
      const token = authStorage.getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      let response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: formData
      });

      if (response.status === 404 && !path.startsWith("/api/")) {
        response = await fetch(`${API_BASE_URL}/api${path}`, {
          method: "POST",
          headers,
          body: formData
        });
      }

      if (response.status === 401 && retryOnUnauthorized) {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        return uploadOnce(path, false);
      }

      const json = (await response.json()) as ApiResponse<{
        attachmentId: string;
        url: string;
        meta: { fileName: string; originalName: string; mimeType: string; size: number };
      }>;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(buildErrorMessage(response, json));
      }

      return json.data;
    };

    return uploadOnce("/uploads");
  },

  deleteAsset(id: string) {
    return request<{ deleted: boolean }>(`/assets/${id}`, {
      method: "DELETE"
    });
  },

  addAssetMovement(
    assetId: string,
    payload: {
      movedToProjectNumber?: string | null;
      movedToProjectName?: string | null;
      dateOfMoving: string;
      movedToUser?: string | null;
      moveToStore?: boolean;
    }
  ) {
    return request<AssetMovementItem>(`/assets/${assetId}/movements`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  addAssetMaintenance(assetId: string, payload: { dateOfMaintenance: string; repairCostInclGst: number; remark?: string | null }) {
    return request<AssetMaintenanceItem>(`/assets/${assetId}/maintenances`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getAssetStats() {
    return request<AssetStatsResponse>("/assets/stats");
  },

  getAssetCatalog() {
    return request<Array<{ id: string; className: string; types: string[]; sortOrder: number }>>("/assets/catalog");
  },

  createAssetCatalogEntry(payload: { className: string; types: string[] }) {
    return request<{ id: string; className: string; types: string[]; sortOrder: number }>("/assets/catalog", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateAssetCatalogEntry(id: string, payload: { className?: string; types?: string[] }) {
    return request<{ id: string; className: string; types: string[]; sortOrder: number }>(`/assets/catalog/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteAssetCatalogEntry(id: string) {
    return request<{ deleted: boolean }>(`/assets/catalog/${id}`, {
      method: "DELETE"
    });
  },

  getProjectNumberingOptions() {
    return request<{
      companies: Array<{ label: string; code: string }>;
      technicalUnits: Array<{ label: string; code: string }>;
      subTechnicalUnits: Record<string, Array<{ label: string; code: string }>>;
      workCategories: {
        fieldHighwayTesting: Array<{ label: string; code: string }>;
        default: Array<{ label: string; code: string }>;
      };
    }>("/projects/numbering-options");
  },

  previewProjectNumber(payload: {
    companyCode: string;
    technicalUnitCode: "T" | "S" | "D";
    subTechnicalUnitCode: string;
    financialYearShort?: number;
  }) {
    return request<{ projectCodePrefix: string; financialYearShort: number; serialNumber: number; baseCode: string }>("/projects/preview-number", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  assignProjectNumber(
    projectId: string,
    payload: {
      companyCode: string;
      technicalUnitCode: "T" | "S" | "D";
      subTechnicalUnitCode: string;
      workCategoryCode: string;
      financialYearShort?: number;
    }
  ) {
    const candidates = [
      `/projects/${projectId}/assign-number`,
      `/projects/assign-number/${projectId}`,
      `/projects/${projectId}/number`,
      `/projects/${projectId}/project-number`
    ];

    const tryNext = async (index: number): Promise<ProjectItem> => {
      if (index >= candidates.length) {
        throw new Error("Assign-number API is unavailable on the configured backend.");
      }

      try {
        return await request<ProjectItem>(candidates[index], {
          method: "POST",
          body: JSON.stringify(payload)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        if (/route not found|404|cannot post/i.test(message)) {
          return tryNext(index + 1);
        }
        throw error;
      }
    };

    return tryNext(0);
  },

  getDprActivities() {
    return request<Array<{ id: string; label: string; description: string; reference?: string }>>("/tasks/dpr-activities");
  },

  createProject(payload: { name: string; description?: string; projectNumber?: string }) {
    return request<ProjectItem>("/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateProject(
    id: string,
    payload: Partial<
      Pick<
        ProjectItem,
        | "name"
        | "description"
        | "projectNumber"
        | "projectCodePrefix"
        | "companyCode"
        | "technicalUnitCode"
        | "subTechnicalUnitCode"
        | "workCategoryCode"
        | "financialYearShort"
        | "serialNumber"
        | "projectNumberAssignedAt"
        | "woAmount"
        | "woGstAmount"
        | "woTotalAmount"
        | "excessAmount"
        | "excessGstAmount"
        | "excessTotalAmount"
        | "bgAmount"
        | "bgIssueDate"
        | "bgExpiryDate"
        | "emdAmount"
        | "emdIssueDate"
        | "emdExpiryDate"
      >
    > & {
      bgIssueDate?: string | null;
      bgExpiryDate?: string | null;
      emdIssueDate?: string | null;
      emdExpiryDate?: string | null;
    }
  ) {
    const candidates: Array<{ path: string; method: "PATCH" | "POST" }> = [
      { path: `/projects/${id}`, method: "PATCH" },
      { path: `/projects/update/${id}`, method: "PATCH" },
      { path: `/projects/${id}/update`, method: "PATCH" },
      { path: `/projects/${id}`, method: "POST" }
    ];

    const tryNext = async (index: number): Promise<ProjectItem> => {
      if (index >= candidates.length) {
        throw new Error("Project update API is unavailable on the configured backend.");
      }

      const candidate = candidates[index];
      try {
        return await request<ProjectItem>(candidate.path, {
          method: candidate.method,
          body: JSON.stringify(payload)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        if (/route not found|404|cannot patch|cannot post/i.test(message)) {
          return tryNext(index + 1);
        }
        throw error;
      }
    };

    return tryNext(0);
  },

  deleteProject(id: string) {
    return request<{ deleted: boolean }>(`/projects/${id}`, {
      method: "DELETE"
    });
  },

  getFinancialProjects() {
    return request<FinancialProjectSummary[]>("/financials/projects");
  },

  getAllProjectsBillStatus() {
    return request<FinancialAllProjectsBillStatusSummary>("/financials/bill-status/projects");
  },

  getProjectFinancial(projectId: string) {
    return request<FinancialProjectDetail>(`/financials/${projectId}`);
  },

  upsertFinancialPlan(
    projectId: string,
    payload: { planningType?: "NORMAL" | "EXCESS"; items: Array<{ itemNumber: number; particulars: string; percentage: number }> }
  ) {
    return request<FinancialPlan>(`/financials/${projectId}/plan`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  createFinancialBills(
    projectId: string,
    payload: { bills: Array<{ itemId: string; includePreviousRemaining?: boolean; status: FinancialBillStatus; remark?: string | null }> }
  ) {
    return request<FinancialPlan>(`/financials/${projectId}/bills`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  createRaBill(
    projectId: string,
    payload: {
      planningType?: "NORMAL" | "EXCESS";
      items: Array<{ itemId: string; billPercentage: number }>;
      carryForwards?: Array<{ sourceRaBillId: string; amount: number }>;
    }
  ) {
    const candidates: Array<{ path: string; body: unknown }> = [
      {
        path: `/financials/${projectId}/ra-bills`,
        body: payload
      }
    ];

    if (!payload.carryForwards || payload.carryForwards.length === 0) {
      candidates.push({
        // Backward-compatible fallback for older backend versions.
        path: `/financials/${projectId}/bills`,
        body: {
          bills: payload.items.map((item) => ({
            itemId: item.itemId,
            includePreviousRemaining: false,
            status: "PLANNING" as FinancialBillStatus,
            remark: `RA bill percentage: ${item.billPercentage}`
          }))
        }
      });
    }

    const tryNext = async (index: number): Promise<FinancialPlan> => {
      if (index >= candidates.length) {
        throw new Error("RA bill API is unavailable on the configured backend.");
      }

      const candidate = candidates[index];
      try {
        return await request<FinancialPlan>(candidate.path, {
          method: "POST",
          body: JSON.stringify(candidate.body)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        if (/route not found|404|cannot post/i.test(message)) {
          return tryNext(index + 1);
        }
        throw error;
      }
    };

    return tryNext(0);
  },

  updateRaBill(
    raBillId: string,
    payload: {
      status?: FinancialBillStatus;
      receivedDate?: string | null;
      chequeRtgsAmount?: number;
      itDeductionPct?: number;
      lCessDeductionPct?: number;
      securityDepositPct?: number;
      recoverFromRaBillPct?: number;
      gstWithheldPct?: number;
      withheldPct?: number;
      remark?: string | null;
    }
  ) {
    const candidates: Array<{ path: string; body: unknown }> = [
      {
        path: `/financials/ra-bills/${raBillId}`,
        body: payload
      },
      {
        // Backward-compatible fallback for older backend versions.
        path: `/financials/bills/${raBillId}`,
        body: {
          status: payload.status,
          receivedDate: payload.receivedDate,
          remark: payload.remark
        }
      }
    ];

    const tryNext = async (index: number): Promise<FinancialRaBill> => {
      if (index >= candidates.length) {
        throw new Error("RA bill update API is unavailable on the configured backend.");
      }

      const candidate = candidates[index];
      try {
        return await request<FinancialRaBill>(candidate.path, {
          method: "PATCH",
          body: JSON.stringify(candidate.body)
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Request failed";
        if (/route not found|404|cannot patch/i.test(message)) {
          return tryNext(index + 1);
        }
        throw error;
      }
    };

    return tryNext(0);
  },

  updateFinancialBill(
    billId: string,
    payload: { status?: FinancialBillStatus; receivedAmount?: number; receivedDate?: string | null; remark?: string | null }
  ) {
    return request<FinancialBillItem>(`/financials/bills/${billId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  createEmployee(payload: { name: string; email: string; password: string }) {
    return request<CreateEmployeeResponse>("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  deleteEmployee(id: string) {
    return request<{ deleted: boolean }>(`/users/${id}`, {
      method: "DELETE"
    });
  },

  getProfile() {
    return request<ApiUser>("/users/me");
  },

  updateProfile(payload: {
    name?: string;
    email?: string;
    contactNumber?: string | null;
    education?: string | null;
    yearOfPassing?: string | null;
    dateOfJoining?: string | null;
    experienceInOrg?: string | null;
  }) {
    return request<ApiUser>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }).then((updatedUser) => {
      const accessToken = authStorage.getAccessToken();
      const refreshToken = authStorage.getRefreshToken();
      if (accessToken && refreshToken) {
        authStorage.setUser(updatedUser);
      }
      return updatedUser;
    });
  },

  getNotifications(limit = 30) {
    return request<AppNotification[]>(`/notifications?limit=${limit}`);
  },

  markNotificationRead(id: string) {
    return request<{ updated: boolean }>(`/notifications/${id}/read`, {
      method: "PATCH"
    });
  },

  markAllNotificationsRead() {
    return request<{ updated: number }>("/notifications/read-all", {
      method: "PATCH"
    });
  },

  chatAssistant(payload: { message: string; conversation?: AssistantConversationMessage[]; draft?: AssistantDraft }) {
    return request<AssistantChatResponse>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getExpenseCategories() {
    return request<ExpenseCategoryItem[]>("/expenses/categories");
  },

  getExpenseDashboard() {
    return request<ExpenseDashboardStats>("/expenses/dashboard");
  },

  getExpenseEmployeeCategoryAnalytics(employeeId?: string) {
    const suffix = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    return request<ExpenseEmployeeCategoryAnalytics>(`/expenses/analytics/employee-categories${suffix}`);
  },

  getExpenseSheets(params?: Record<string, string | number | boolean | undefined>) {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") query.set(key, String(value));
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<{ items: ExpenseSheetItem[]; page: number; limit: number; total: number; totalPages: number }>(
      `/expenses/sheets${suffix}`
    );
  },

  getExpenseSheet(id: string) {
    return request<ExpenseSheetItem>(`/expenses/sheets/${id}`);
  },

  createExpenseSheet(payload: {
    projectId?: string | null;
    employeeName: string;
    siteName: string;
    siteIncharge: string;
    totalPersons: number;
    expenseDate: string;
    mobileNumber?: string | null;
    bankAccount?: string | null;
    sheetNumber?: number | null;
  }) {
    return request<ExpenseSheetItem>("/expenses/sheets", { method: "POST", body: JSON.stringify(payload) });
  },

  updateExpenseSheet(
    id: string,
    payload: Partial<{
      projectId: string | null;
      employeeName: string;
      siteName: string;
      siteIncharge: string;
      totalPersons: number;
      expenseDate: string;
      mobileNumber: string | null;
      bankAccount: string | null;
      sheetNumber: number | null;
    }>
  ) {
    return request<ExpenseSheetItem>(`/expenses/sheets/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  deleteExpenseSheet(id: string) {
    return request<{ deleted: boolean }>(`/expenses/sheets/${id}`, { method: "DELETE" });
  },

  submitExpenseSheet(id: string) {
    return request<ExpenseSheetItem>(`/expenses/sheets/${id}/submit`, { method: "POST" });
  },

  reviewExpenseSheet(id: string, payload: { status: "APPROVED" | "REJECTED"; comments?: string | null }) {
    return request<ExpenseSheetItem>(`/expenses/sheets/${id}/review`, { method: "POST", body: JSON.stringify(payload) });
  },

  addExpenseEntry(
    sheetId: string,
    payload: {
      categoryId: string;
      entryDate: string;
      amount: number;
      description: string;
      billAvailable: boolean;
      billNumber?: string | null;
      billAttachmentUrl?: string | null;
    }
  ) {
    return request<ExpenseSheetItem>(`/expenses/sheets/${sheetId}/entries`, { method: "POST", body: JSON.stringify(payload) });
  },

  updateExpenseEntry(
    entryId: string,
    payload: Partial<{
      categoryId: string;
      entryDate: string;
      amount: number;
      description: string;
      billAvailable: boolean;
      billNumber: string | null;
      billAttachmentUrl: string | null;
    }>
  ) {
    return request<ExpenseSheetItem>(`/expenses/entries/${entryId}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  deleteExpenseEntry(entryId: string) {
    return request<ExpenseSheetItem>(`/expenses/entries/${entryId}`, { method: "DELETE" });
  },

  getExpenseVouchers(params?: Record<string, string | undefined>) {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) query.set(key, value);
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<{ items: ExpenseVoucherItem[]; page: number; limit: number; total: number; totalPages: number }>(
      `/expenses/vouchers${suffix}`
    );
  }
};
