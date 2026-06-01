import type { Request, Response } from "express";
import { dprOverviewService } from "../services/dpr-overview.service.js";
import { sendSuccess } from "../utils/response.js";

export const dprOverviewController = {
  async list(_req: Request, res: Response) {
    const items = await dprOverviewService.list();
    return sendSuccess(res, items);
  },
  async getByProject(req: Request, res: Response) {
    const item = await dprOverviewService.getByProject(req.params.projectId);
    return sendSuccess(res, item);
  },
  async create(req: Request, res: Response) {
    const item = await dprOverviewService.create(req.body);
    return sendSuccess(res, item, 201);
  },
  async update(req: Request, res: Response) {
    const item = await dprOverviewService.update(req.params.id, req.body);
    return sendSuccess(res, item);
  },
  async remove(req: Request, res: Response) {
    const result = await dprOverviewService.remove(req.params.id);
    return sendSuccess(res, result);
  }
};
