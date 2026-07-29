import type { Request, Response } from "express";
import { operationsService } from "../services/operations.service.js";
import { sendSuccess } from "../utils/response.js";

export const operationsController = {
  async list(req: Request, res: Response) {
    const result = await operationsService.list(
      {
        workCategory: req.query.workCategory as string | undefined,
        client: req.query.client as string | undefined,
        search: req.query.search as string | undefined
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const result = await operationsService.getById(req.params.id);
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await operationsService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await operationsService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await operationsService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  }
};
