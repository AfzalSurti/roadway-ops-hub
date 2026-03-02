import type { Prisma, ReportStatus, Role } from "@prisma/client";
import { reportRepository } from "../repositories/report.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { templateRepository } from "../repositories/template.repository.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";
import { auditService } from "./audit.service.js";
import { templateFieldsSchema } from "../validators/template.validator.js";

type ReportFilters = {
  status?: ReportStatus;
  reportTemplateId?: string;
  submittedById?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

function validateSubmission(templateFields: unknown, submission: Record<string, unknown>): void {
  const fields = templateFieldsSchema.parse(templateFields);

  for (const field of fields) {
    const value = submission[field.id];
    if (field.required && (value === undefined || value === null || value === "")) {
      throw badRequest(`Field ${field.label} is required`);
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.type === "number" && typeof value !== "number") {
      throw badRequest(`Field ${field.label} must be a number`);
    }

    if (field.type === "checkbox" && typeof value !== "boolean") {
      throw badRequest(`Field ${field.label} must be a boolean`);
    }

    if ((field.type === "text" || field.type === "textarea" || field.type === "photo" || field.type === "file") && typeof value !== "string") {
      throw badRequest(`Field ${field.label} must be a string`);
    }

    if (field.type === "date" && Number.isNaN(Date.parse(String(value)))) {
      throw badRequest(`Field ${field.label} must be a valid date`);
    }

    if (field.type === "select") {
      if (typeof value !== "string") {
        throw badRequest(`Field ${field.label} must be a string`);
      }
      if (field.options?.length && !field.options.includes(value)) {
        throw badRequest(`Field ${field.label} must be one of allowed options`);
      }
    }
  }
}

export const reportService = {
  async create(payload: { taskId: string; reportTemplateId: string; submission: Record<string, unknown> }, userId: string) {
    const task = await taskRepository.findById(payload.taskId);
    if (!task) {
      throw notFound("Task not found");
    }
    if (task.assignedToId !== userId) {
      throw badRequest("You are not assigned to this task");
    }
    if (task.reportTemplateId !== payload.reportTemplateId) {
      throw badRequest("Template does not match task template");
    }

    const template = await templateRepository.findById(payload.reportTemplateId);
    if (!template) {
      throw notFound("Report template not found");
    }

    validateSubmission(template.fields, payload.submission);

    const report = await reportRepository.create({
      taskId: payload.taskId,
      reportTemplateId: payload.reportTemplateId,
      submittedById: userId,
      submission: payload.submission as Prisma.InputJsonValue,
      templateSnapshot: template.fields as Prisma.InputJsonValue,
      status: "SUBMITTED"
    });

    await auditService.log({
      action: "REPORT_SUBMITTED",
      actorId: userId,
      entityType: "Report",
      entityId: report.id
    });

    return report;
  },

  async list(user: { id: string; role: Role }, filters: ReportFilters) {
    const pagination = getPagination(filters);
    const where: Prisma.ReportWhereInput = {
      submittedById: user.role === "EMPLOYEE" ? user.id : filters.submittedById,
      status: filters.status,
      reportTemplateId: filters.reportTemplateId,
      createdAt:
        filters.dateFrom || filters.dateTo
          ? {
              gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
              lte: filters.dateTo ? new Date(filters.dateTo) : undefined
            }
          : undefined
    };

    const [items, total] = await Promise.all([
      reportRepository.findMany(where, pagination.skip, pagination.limit),
      reportRepository.count(where)
    ]);

    return {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  },

  async getById(id: string) {
    const report = await reportRepository.findById(id);
    if (!report) {
      throw notFound("Report not found");
    }
    return report;
  },

  async updateStatus(id: string, status: ReportStatus, adminId: string) {
    await this.getById(id);
    const updated = await reportRepository.update(id, { status });
    await auditService.log({
      action: "REPORT_REVIEWED",
      actorId: adminId,
      entityType: "Report",
      entityId: id,
      meta: { status }
    });
    return updated;
  },

  async updateFeedback(id: string, adminFeedback: string, adminId: string) {
    await this.getById(id);
    const updated = await reportRepository.update(id, { adminFeedback });
    await auditService.log({
      action: "REPORT_REVIEWED",
      actorId: adminId,
      entityType: "Report",
      entityId: id,
      meta: { feedback: true }
    });
    return updated;
  }
};