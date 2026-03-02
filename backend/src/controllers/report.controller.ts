import type { Request, Response } from "express";
import { reportService } from "../services/report.service.js";
import { sendSuccess } from "../utils/response.js";

export const reportController = {
  async create(req: Request, res: Response) {
    const result = await reportService.create(req.body, req.user!.id);
    return sendSuccess(res, result, 201);
  },
  async list(req: Request, res: Response) {
    const result = await reportService.list(req.user!, {
      status: req.query.status as never,
      reportTemplateId: req.query.reportTemplateId as string | undefined,
      submittedById: req.query.submittedById as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    });
    return sendSuccess(res, result);
  },
  async getById(req: Request, res: Response) {
    const result = await reportService.getById(req.params.id);
    return sendSuccess(res, result);
  },
  async updateStatus(req: Request, res: Response) {
    const result = await reportService.updateStatus(req.params.id, req.body.status, req.user!.id);
    return sendSuccess(res, result);
  },
  async updateFeedback(req: Request, res: Response) {
    const result = await reportService.updateFeedback(req.params.id, req.body.adminFeedback, req.user!.id);
    return sendSuccess(res, result);
  }
};