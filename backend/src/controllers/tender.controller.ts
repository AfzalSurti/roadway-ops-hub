import type { Request, Response } from "express";
import { tenderService } from "../services/tender.service.js";
import { sendSuccess } from "../utils/response.js";

export const tenderController = {
  async list(req: Request, res: Response) {
    const result = await tenderService.list(
      {
        workCategory: req.query.workCategory as string | undefined,
        client: req.query.client as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const result = await tenderService.getById(req.params.id);
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await tenderService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await tenderService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await tenderService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  }
};
