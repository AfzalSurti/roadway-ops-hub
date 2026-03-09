import type { Request, Response } from "express";
import { taskService } from "../services/task.service.js";
import { sendSuccess } from "../utils/response.js";
import { dprActivityService } from "../services/dpr-activity.service.js";

export const taskController = {
  async listDprActivities(_req: Request, res: Response) {
    const result = await dprActivityService.list();
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const allocatedAt = new Date(req.body.allocatedAt);
    const allottedDays = req.body.allottedDays ? Number(req.body.allottedDays) : 0;
    const dueDate = new Date(allocatedAt);
    dueDate.setDate(dueDate.getDate() + allottedDays);

    const payload = {
      ...req.body,
      description: typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : "-",
      allocatedAt,
      dueDate,
      createdById: req.user!.id,
      status: "TODO"
    };

    const result = await taskService.create(
      payload,
      req.user!.id
    );
    return sendSuccess(res, result, 201);
  },

  async list(req: Request, res: Response) {
    const result = await taskService.list(req.user!, {
      assignedToId: req.query.assignedToId as string | undefined,
      status: req.query.status as never,
      reportTemplateId: req.query.reportTemplateId as string | undefined,
      priority: req.query.priority as never,
      dueDateFrom: req.query.dueDateFrom as string | undefined,
      dueDateTo: req.query.dueDateTo as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    });
    return sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const result = await taskService.getById(req.params.id);
    return sendSuccess(res, result);
  },

  async update(req: Request, res: Response) {
    const payload = {
      ...req.body,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      submittedForReviewAt: req.body.submittedForReviewAt ? new Date(req.body.submittedForReviewAt) : req.body.submittedForReviewAt,
      reviewCompletedAt: req.body.reviewCompletedAt ? new Date(req.body.reviewCompletedAt) : req.body.reviewCompletedAt,
      actualCompletedAt: req.body.actualCompletedAt ? new Date(req.body.actualCompletedAt) : req.body.actualCompletedAt
    };
    const result = await taskService.update(req.params.id, payload, req.user!.id);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await taskService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  },

  async complete(req: Request, res: Response) {
    const result = await taskService.completeByEmployee(req.params.id, req.user!.id, req.body.note);
    return sendSuccess(res, result);
  },

  async acknowledgeComment(req: Request, res: Response) {
    const result = await taskService.acknowledgeManagerComment(req.params.id, req.user!.id);
    return sendSuccess(res, result);
  }
};