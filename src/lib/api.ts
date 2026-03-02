// Placeholder API service layer
// Replace these with actual API calls when backend is ready

import { tasks, reports, templates, users, type Task, type Report, type Template, type User } from "./mock-data";

export const api = {
  // Auth
  login: async (role: "admin" | "employee"): Promise<User> => {
    await delay(500);
    return role === "admin" ? users[0] : users[1];
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    await delay(300);
    return [...tasks];
  },
  getTask: async (id: string): Promise<Task | undefined> => {
    await delay(200);
    return tasks.find((t) => t.id === id);
  },
  createTask: async (task: Omit<Task, "id" | "createdAt">): Promise<Task> => {
    await delay(400);
    const newTask: Task = { ...task, id: `t${Date.now()}`, createdAt: new Date().toISOString() };
    return newTask;
  },
  updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
    await delay(300);
    const task = tasks.find((t) => t.id === id);
    return { ...task!, ...updates };
  },

  // Reports
  getReports: async (): Promise<Report[]> => {
    await delay(300);
    return [...reports];
  },
  submitReport: async (report: Omit<Report, "id">): Promise<Report> => {
    await delay(400);
    return { ...report, id: `r${Date.now()}` };
  },
  updateReportStatus: async (id: string, status: Report["status"], feedback?: string): Promise<Report> => {
    await delay(300);
    const report = reports.find((r) => r.id === id);
    return { ...report!, status, feedback };
  },

  // Templates
  getTemplates: async (): Promise<Template[]> => {
    await delay(200);
    return [...templates];
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    await delay(200);
    return [...users];
  },
  getUser: async (id: string): Promise<User | undefined> => {
    await delay(100);
    return users.find((u) => u.id === id);
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
