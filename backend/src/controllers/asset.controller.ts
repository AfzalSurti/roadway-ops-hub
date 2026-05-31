import type { Request, Response } from "express";
import { assetService } from "../services/asset.service.js";
import { sendSuccess } from "../utils/response.js";

export const assetController = {
  async list(req: Request, res: Response) {
    const result = await assetService.list(
      {
        projectNumber: req.query.projectNumber as string | undefined,
        assetClass: req.query.assetClass as string | undefined,
        status: req.query.status as never,
        search: req.query.search as string | undefined
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const result = await assetService.getById(req.params.id);
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await assetService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await assetService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    const result = await assetService.remove(req.params.id);
    return sendSuccess(res, result);
  },

  async addMovement(req: Request, res: Response) {
    const result = await assetService.addMovement(req.params.id, req.body);
    return sendSuccess(res, result, 201);
  },

  async addMaintenance(req: Request, res: Response) {
    const result = await assetService.addMaintenance(req.params.id, req.body);
    return sendSuccess(res, result, 201);
  },

  async getStats(_req: Request, res: Response) {
    const result = await assetService.getStats();
    return sendSuccess(res, result);
  }
};
