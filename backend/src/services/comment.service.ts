import type { Role } from "@prisma/client";
import { commentRepository } from "../repositories/comment.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { forbidden, notFound } from "../utils/errors.js";
import { auditService } from "./audit.service.js";

export const commentService = {
  async create(taskId: string, body: string, user: { id: string; role: Role }) {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw notFound("Task not found");
    }

    if (user.role === "EMPLOYEE" && task.assignedToId !== user.id) {
      throw forbidden("Task comment access denied");
    }

    const comment = await commentRepository.create({
      taskId,
      body,
      authorId: user.id
    });

    await auditService.log({
      action: "TASK_UPDATED",
      actorId: user.id,
      entityType: "Task",
      entityId: taskId,
      meta: { commentAdded: true }
    });

    return comment;
  },

  async list(taskId: string, user: { id: string; role: Role }) {
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw notFound("Task not found");
    }
    if (user.role === "EMPLOYEE" && task.assignedToId !== user.id) {
      throw forbidden("Task comment access denied");
    }
    return commentRepository.findByTaskId(taskId);
  }
};