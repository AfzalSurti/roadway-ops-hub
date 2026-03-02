import type { Prisma, Role, TaskStatus } from "@prisma/client";
import { taskRepository } from "../repositories/task.repository.js";
import { notFound } from "../utils/errors.js";
import { getPagination } from "../utils/pagination.js";
import { auditService } from "./audit.service.js";

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
    const created = await taskRepository.create(payload);
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
    const updated = await taskRepository.update(id, data);
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