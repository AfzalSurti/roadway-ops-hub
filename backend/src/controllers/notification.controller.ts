import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service.js";
import { sendSuccess } from "../utils/response.js";

export const notificationController = {
  async list(req: Request, res: Response) {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const result = await notificationService.listForUser(req.user!.id, limit);
    return sendSuccess(res, result);
  },

  async markRead(req: Request, res: Response) {
    const result = await notificationService.markRead(req.params.id, req.user!.id);
    return sendSuccess(res, result);
  },

  async markAllRead(req: Request, res: Response) {
    const result = await notificationService.markAllRead(req.user!.id);
    return sendSuccess(res, result);
  }
};
