import type { Request, Response } from "express";
import { projectBillingService } from "../services/project-billing.service.js";
import { sendSuccess } from "../utils/response.js";

export const projectBillingController = {
  async listByProject(req: Request, res: Response) {
    const result = await projectBillingService.listByProject(req.params.projectId);
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await projectBillingService.create(req.params.projectId, req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await projectBillingService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    const result = await projectBillingService.remove(req.params.id);
    return sendSuccess(res, result);
  },

  async getSummary(_req: Request, res: Response) {
    const result = await projectBillingService.getSummary();
    return sendSuccess(res, result);
  }
};
