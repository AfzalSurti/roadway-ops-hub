import type { Prisma, Role, TaskStatus } from "@prisma/client";
import { taskRepository } from "../repositories/task.repository.js";
import { templateRepository } from "../repositories/template.repository.js";
import { commentRepository } from "../repositories/comment.repository.js";
import { badRequest, notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";
import { auditService } from "./audit.service.js";
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

type TaskFilters = {
  assignedToId?: string;
  status?: TaskStatus;
  reportTemplateId?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export const taskService = {
  async create(payload: Prisma.TaskUncheckedCreateInput, actorId: string) {
    let reportTemplateId = payload.reportTemplateId;

    if (!reportTemplateId) {
      const defaultName = "Default DPR Template";
      const byName = await templateRepository.findByName(defaultName);
      const existing = byName ?? (await templateRepository.findFirst());
      const template =
        existing ??
        (await templateRepository.create({
          name: defaultName,
          description: "Auto-created default template for DPR task workflow",
          fields: []
        }));
      reportTemplateId = template.id;
    }

    const created = await taskRepository.create({
      ...payload,
      reportTemplateId
    });
    await auditService.log({
      action: "TASK_CREATED",
      actorId,
      entityType: "Task",
      entityId: created.id
    });
    return created;
  },

  async list(user: { id: string; role: Role }, filters: TaskFilters) {
    const pagination = getPagination(filters);

    const where: Prisma.TaskWhereInput = {
      assignedToId: user.role === "EMPLOYEE" ? user.id : filters.assignedToId,
      status: filters.status,
      reportTemplateId: filters.reportTemplateId,
      priority: filters.priority,
      dueDate:
        filters.dueDateFrom || filters.dueDateTo
          ? {
              gte: filters.dueDateFrom ? new Date(filters.dueDateFrom) : undefined,
              lte: filters.dueDateTo ? new Date(filters.dueDateTo) : undefined
            }
          : undefined,
      OR: filters.search
        ? [
            { title: { contains: filters.search } },
            { description: { contains: filters.search } },
            { project: { contains: filters.search } }
          ]
        : undefined
    };

    const [items, total] = await Promise.all([
      taskRepository.findMany(where, pagination.skip, pagination.limit),
      taskRepository.count(where)
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
    const task = await taskRepository.findById(id);
    if (!task) {
      throw notFound("Task not found");
    }
    return task;
  },

  async update(id: string, data: Prisma.TaskUncheckedUpdateInput, actorId: string) {
    await this.getById(id);
    const previous = await taskRepository.findById(id);
    const normalizedData: Prisma.TaskUncheckedUpdateInput = { ...data };

    if (data.status === "DONE" && previous) {
      const completedAt = data.actualCompletedAt ? new Date(String(data.actualCompletedAt)) : new Date();
      const baselineStart = previous.allocatedAt ?? previous.createdAt;
      const completionDays = calculateDayDifference(baselineStart, completedAt);
      const baselineDays = previous.allottedDays ?? calculateDayDifference(baselineStart, previous.dueDate);
      const completionDelayDays = Math.max(0, completionDays - baselineDays);

      normalizedData.actualCompletedAt = completedAt;
      normalizedData.completionDays = completionDays;
      normalizedData.completionDelayDays = completionDelayDays;
      normalizedData.rating = previous.ratingEnabled ? ratingFromDelay(completionDelayDays) : null;
      normalizedData.submittedForReviewAt = normalizedData.submittedForReviewAt ?? completedAt;
    }

    const updated = await taskRepository.update(id, normalizedData);
    await auditService.log({
      action: "TASK_UPDATED",
      actorId,
      entityType: "Task",
      entityId: id
    });

    if (data.status && previous?.status !== data.status) {
      await auditService.log({
        action: "STATUS_CHANGED",
        actorId,
        entityType: "Task",
        entityId: id,
        meta: { from: previous?.status, to: data.status }
      });
    }

    return updated;
  },

  async remove(id: string) {
    await this.getById(id);
    return taskRepository.delete(id);
  },

  async completeByEmployee(taskId: string, employeeId: string, note?: string) {
    const task = await this.getById(taskId);
    if (task.status === "DONE") {
      throw badRequest("Task is already approved and completed");
    }

    const submittedAt = new Date();

    const updated = await taskRepository.update(taskId, {
      status: "IN_PROGRESS",
      submittedForReviewAt: submittedAt,
      managerReviewComments: null,
      reviewCompletedAt: null
    });

    if (note?.trim()) {
      await commentRepository.create({
        taskId,
        body: note.trim(),
        authorId: employeeId
      });
    }

    const admins = await userRepository.findAdmins();
    const assignedOn = new Date(task.allocatedAt ?? task.createdAt).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const submittedOn = submittedAt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const dueOn = new Date(task.dueDate).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    await notificationService.notifyUsers({
      userIds: admins.map((admin) => admin.id),
      title: "Task Submitted",
      message: `Submitted by ${task.assignedTo?.name ?? "Employee"} | Project: ${task.project} | Task: ${task.title} | Assigned: ${assignedOn} | Submitted: ${submittedOn} | Due: ${dueOn}${note?.trim() ? ` | Note: ${note.trim().slice(0, 120)}` : ""}`,
      entityType: "Task",
      entityId: taskId
    });

    return updated;
  },

  async approveByAdmin(taskId: string, adminId: string) {
    const task = await this.getById(taskId);
    const reviewedAt = new Date();
    const effectiveCompletedAt = task.submittedForReviewAt ?? reviewedAt;
    const baselineStart = task.allocatedAt ?? task.createdAt;
    const completionDays = calculateDayDifference(baselineStart, effectiveCompletedAt);
    const baselineDays = task.allottedDays ?? calculateDayDifference(baselineStart, task.dueDate);
    const completionDelayDays = Math.max(0, completionDays - baselineDays);

    const updated = await taskRepository.update(taskId, {
      status: "DONE",
      reviewCompletedAt: reviewedAt,
      actualCompletedAt: effectiveCompletedAt,
      completionDays,
      completionDelayDays,
      rating: task.ratingEnabled ? ratingFromDelay(completionDelayDays) : null
    });

    await notificationService.notifyUsers({
      userIds: [task.assignedToId],
      title: "Task Approved",
      message: `${task.title} was approved by admin and marked as done.`,
      entityType: "Task",
      entityId: taskId
    });

    await auditService.log({
      action: "TASK_UPDATED",
      actorId: adminId,
      entityType: "Task",
      entityId: taskId,
      meta: { approved: true }
    });

    return updated;
  },

  async requestChangesByAdmin(taskId: string, adminId: string, comment: string) {
    const task = await this.getById(taskId);
    const trimmed = comment.trim();
    if (!trimmed) {
      throw badRequest("Comment is required");
    }

    await commentRepository.create({
      taskId,
      body: trimmed,
      authorId: adminId
    });

    const updated = await taskRepository.update(taskId, {
      status: "TODO",
      managerReviewComments: trimmed,
      reviewCompletedAt: null
    });

    await notificationService.notifyUsers({
      userIds: [task.assignedToId],
      title: "Changes Requested",
      message: `${task.title}: admin added a comment. Please review and resubmit.`,
      entityType: "Task",
      entityId: taskId
    });

    await auditService.log({
      action: "TASK_UPDATED",
      actorId: adminId,
      entityType: "Task",
      entityId: taskId,
      meta: { changesRequested: true }
    });

    return updated;
  },

  async acknowledgeManagerComment(taskId: string, employeeId: string) {
    const task = await this.getById(taskId);
    const resubmittedAt = new Date();

    await taskRepository.update(taskId, {
      status: "IN_PROGRESS",
      submittedForReviewAt: resubmittedAt
    });

    const admins = await userRepository.findAdmins();
    const resubmittedOn = resubmittedAt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    await notificationService.notifyUsers({
      userIds: admins.map((admin) => admin.id),
      title: "Comment Acknowledged",
      message: `${task.assignedTo?.name ?? "Employee"} resubmitted task "${task.title}" for project "${task.project}" at ${resubmittedOn}.`,
      entityType: "Task",
      entityId: taskId
    });

    await auditService.log({
      action: "TASK_UPDATED",
      actorId: employeeId,
      entityType: "Task",
      entityId: taskId,
      meta: { commentAcknowledged: true }
    });

    return { acknowledged: true };
  }
};