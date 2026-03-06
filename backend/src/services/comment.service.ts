import type { Role } from "@prisma/client";
import { commentRepository } from "../repositories/comment.repository.js";
import { taskRepository } from "../repositories/task.repository.js";
import { forbidden, notFound } from "../utils/errors.js";
import { auditService } from "./audit.service.js";
import { notificationService } from "./notification.service.js";
import { userRepository } from "../repositories/user.repository.js";

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

    const recipientIds = user.role === "ADMIN" ? [task.assignedToId] : (await userRepository.findAdmins()).map((admin) => admin.id);
    await notificationService.notifyUsers({
      userIds: recipientIds,
      title: user.role === "ADMIN" ? "Manager Comment" : "Employee Reply",
      message: `${task.title}: ${body.slice(0, 80)}`,
      entityType: "Task",
      entityId: taskId
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