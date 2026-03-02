import type { ApiUser, ReportItem, ReportStatus, ReportTemplate, TaskItem, TaskStatus } from "./domain";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const ACCESS_TOKEN_KEY = "highwayops_access_token";
const REFRESH_TOKEN_KEY = "highwayops_refresh_token";
const USER_KEY = "highwayops_user";

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
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

async function request<T>(path: string, init: RequestInit = {}, useAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (useAuth) {
    const token = authStorage.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? "Request failed");
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
    description: string;
    project: string;
    dueDate: string;
    priority: TaskItem["priority"];
    assignedToId: string;
    reportTemplateId: string;
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

  createEmployee(payload: { name: string; email: string; password: string }) {
    return request<ApiUser>("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};