import type { ApiUser, AppNotification, AssistantChatResponse, AssistantConversationMessage, FinancialAllProjectsBillStatusSummary, FinancialBillItem, FinancialBillStatus, FinancialPlan, FinancialProjectDetail, FinancialProjectSummary, FinancialRaBill, ProjectItem, ProjectRequisitionFormItem, ReportItem, ReportStatus, ReportTemplate, TaskComment, TaskItem, TaskStatus } from "./domain";

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

  getProjectsWithoutNumber() {
    return request<ProjectItem[]>("/projects/without-number");
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

  previewProjectNumber(payload: { companyCode: string; technicalUnitCode: "T" | "S" | "D"; subTechnicalUnitCode: string }) {
    return request<{ projectCodePrefix: string; financialYearShort: number; serialNumber: number; baseCode: string }>("/projects/preview-number", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  assignProjectNumber(
    projectId: string,
    payload: { companyCode: string; technicalUnitCode: "T" | "S" | "D"; subTechnicalUnitCode: string; workCategoryCode: string }
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

  createProject(payload: { name: string; description?: string }) {
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
      >
    >
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
    return request<ApiUser>("/users", {
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

  chatAssistant(payload: { message: string; conversation?: AssistantConversationMessage[] }) {
    return request<AssistantChatResponse>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};