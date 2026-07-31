import type { Request, Response } from "express";
import { contractService } from "../services/contract.service.js";
import { sendSuccess } from "../utils/response.js";

export const contractController = {
  async list(req: Request, res: Response) {
    const result = await contractService.list(
      {
        workCategory: req.query.workCategory as string | undefined,
        client: req.query.client as string | undefined,
        search: req.query.search as string | undefined,
        tenderBidId: req.query.tenderBidId as string | undefined
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  },

  async getById(req: Request, res: Response) {
    const result = await contractService.getById(req.params.id);
    return sendSuccess(res, result);
  },

  async getByTenderBidId(req: Request, res: Response) {
    const result = await contractService.getByTenderBidId(req.params.tenderBidId);
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await contractService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await contractService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await contractService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  }
};
