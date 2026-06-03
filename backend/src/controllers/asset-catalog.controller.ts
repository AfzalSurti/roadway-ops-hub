import type { Request, Response } from "express";
import { assetCatalogService } from "../services/asset-catalog.service.js";
import { sendSuccess } from "../utils/response.js";

export const assetCatalogController = {
  async list(_req: Request, res: Response) {
    const result = await assetCatalogService.list();
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await assetCatalogService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await assetCatalogService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    const result = await assetCatalogService.remove(req.params.id);
    return sendSuccess(res, result);
  }
};
