import type { Request, Response } from "express";
import { taskService } from "../services/task.service.js";
import { sendSuccess } from "../utils/response.js";

export const taskController = {
  async create(req: Request, res: Response) {
    const result = await taskService.create(
      {
        ...req.body,
        dueDate: new Date(req.body.dueDate),
        createdById: req.user!.id,
        status: "TODO"
      },
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
    const payload = req.body.dueDate ? { ...req.body, dueDate: new Date(req.body.dueDate) } : req.body;
    const result = await taskService.update(req.params.id, payload, req.user!.id);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await taskService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  }
};