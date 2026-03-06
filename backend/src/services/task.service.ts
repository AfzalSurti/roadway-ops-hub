import type { Prisma, Role, TaskStatus } from "@prisma/client";
import { taskRepository } from "../repositories/task.repository.js";
import { templateRepository } from "../repositories/template.repository.js";
import { notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";
import { auditService } from "./audit.service.js";

function calculateDayDifference(startAt: Date, endAt: Date): number {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((endAt.getTime() - startAt.getTime()) / dayMs));
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
      const completionDays = calculateDayDifference(previous.createdAt, completedAt);
      const baselineDays = previous.allottedDays ?? calculateDayDifference(previous.createdAt, previous.dueDate);

      normalizedData.actualCompletedAt = completedAt;
      normalizedData.completionDays = completionDays;
      normalizedData.completionDelayDays = Math.max(0, completionDays - baselineDays);
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
  }
};