import type { Prisma, ReportStatus, Role } from "@prisma/client";
import { reportRepository } from "../repositories/report.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { templateRepository } from "../repositories/template.repository.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";
import { auditService } from "./audit.service.js";
import { templateFieldsSchema } from "../validators/template.validator.js";
import { userRepository } from "../repositories/user.repository.js";
import { notificationService } from "./notification.service.js";

function calculateDayDifference(startAt: Date, endAt: Date): number {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / dayMs));
}

function ratingFromDelay(delayDays: number): number {
  if (delayDays <= 0) return 5;
  if (delayDays <= 3) return 4;
  if (delayDays <= 6) return 3;
  if (delayDays <= 9) return 2;
  return 1;
}

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

    const submittedAt = new Date();
    const turnaroundDays = calculateDayDifference(task.createdAt, submittedAt);

    const report = await reportRepository.create({
      taskId: payload.taskId,
      reportTemplateId: payload.reportTemplateId,
      submittedById: userId,
      submission: payload.submission as Prisma.InputJsonValue,
      templateSnapshot: template.fields as Prisma.InputJsonValue,
      status: "SUBMITTED",
      submittedAt,
      turnaroundDays
    });

    const completionDelayDays = task.allottedDays ? Math.max(0, turnaroundDays - task.allottedDays) : undefined;
    await taskRepository.update(task.id, {
      submittedForReviewAt: submittedAt,
      completionDays: turnaroundDays,
      completionDelayDays,
      rating: completionDelayDays === undefined ? undefined : ratingFromDelay(completionDelayDays)
    });

    await auditService.log({
      action: "REPORT_SUBMITTED",
      actorId: userId,
      entityType: "Report",
      entityId: report.id
    });

    const admins = await userRepository.findAdmins();
    await notificationService.notifyUsers({
      userIds: admins.map((admin) => admin.id),
      title: "Task Submitted",
      message: `${task.title} was submitted for your review.`,
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
    const existing = await this.getById(id);
    const updated = await reportRepository.update(id, { status });

    if (status === "APPROVED") {
      const completedAt = new Date();
      const completionDays = calculateDayDifference(existing.task.createdAt, completedAt);
      const completionDelayDays = existing.task.allottedDays ? Math.max(0, completionDays - existing.task.allottedDays) : undefined;
      await taskRepository.update(existing.taskId, {
        status: "DONE",
        reviewCompletedAt: completedAt,
        actualCompletedAt: completedAt,
        completionDays,
        completionDelayDays,
        rating: completionDelayDays === undefined ? undefined : ratingFromDelay(completionDelayDays)
      });
    }

    await auditService.log({
      action: "REPORT_REVIEWED",
      actorId: adminId,
      entityType: "Report",
      entityId: id,
      meta: { status }
    });

    await notificationService.notifyUsers({
      userIds: [existing.submittedById],
      title: `Report ${status.replace("_", " ")}`,
      message: `Your task report for ${existing.task?.title ?? "task"} has been reviewed.`,
      entityType: "Report",
      entityId: id
    });

    return updated;
  },

  async updateFeedback(id: string, adminFeedback: string, adminId: string) {
    const existing = await this.getById(id);
    const updated = await reportRepository.update(id, { adminFeedback });
    await auditService.log({
      action: "REPORT_REVIEWED",
      actorId: adminId,
      entityType: "Report",
      entityId: id,
      meta: { feedback: true }
    });

    await notificationService.notifyUsers({
      userIds: [existing.submittedById],
      title: "Changes Requested",
      message: `Admin added feedback on ${existing.task?.title ?? "your report"}.`,
      entityType: "Report",
      entityId: id
    });

    return updated;
  }
};