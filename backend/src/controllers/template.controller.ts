import type { Request, Response } from "express";
import { templateService } from "../services/template.service.js";
import { sendSuccess } from "../utils/response.js";

export const templateController = {
  async create(req: Request, res: Response) {
    const result = await templateService.create(req.body, req.user!.id);
    return sendSuccess(res, result, 201);
  },
  async list(_req: Request, res: Response) {
    const result = await templateService.list();
    return sendSuccess(res, result);
  },
  async getById(req: Request, res: Response) {
    const result = await templateService.getById(req.params.id);
    return sendSuccess(res, result);
  },
  async update(req: Request, res: Response) {
    const result = await templateService.update(req.params.id, req.body, req.user!.id);
    return sendSuccess(res, result);
  },
  async remove(req: Request, res: Response) {
    await templateService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  }
};