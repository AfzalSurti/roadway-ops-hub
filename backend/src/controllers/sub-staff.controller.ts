import type { Request, Response } from "express";
import { subStaffService } from "../services/sub-staff.service.js";
import { sendSuccess } from "../utils/response.js";
import type { SubStaffAssignmentStatus } from "@prisma/client";

function strParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const subStaffController = {
  async list(req: Request, res: Response) {
    const result = await subStaffService.list({
      status: strParam(req.query.status) as SubStaffAssignmentStatus | undefined,
      staffName: strParam(req.query.staffName),
      siteName: strParam(req.query.siteName),
      designation: strParam(req.query.designation)
    });
    return sendSuccess(res, result);
  },

  async create(req: Request, res: Response) {
    const result = await subStaffService.create(req.body);
    return sendSuccess(res, result, 201);
  },

  async bulkImport(req: Request, res: Response) {
    const result = await subStaffService.bulkImport(req.body.rows);
    return sendSuccess(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const result = await subStaffService.update(req.params.id, req.body);
    return sendSuccess(res, result);
  },

  async remove(req: Request, res: Response) {
    await subStaffService.remove(req.params.id);
    return sendSuccess(res, { deleted: true });
  },

  async getOptions(_req: Request, res: Response) {
    const result = await subStaffService.getOptions();
    return sendSuccess(res, result);
  },

  async getClashReport(_req: Request, res: Response) {
    const result = await subStaffService.getClashReport();
    return sendSuccess(res, result);
  },

  async getPlanGrid(req: Request, res: Response) {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const result = await subStaffService.getPlanGrid(year, month);
    return sendSuccess(res, result);
  },

  async generatePlan(req: Request, res: Response) {
    const result = await subStaffService.generatePlan(req.body.year, req.body.month);
    return sendSuccess(res, result);
  },

  async setPlanDay(req: Request, res: Response) {
    const result = await subStaffService.setPlanDay(req.params.id, req.body.year, req.body.month, req.body.plannedDays);
    return sendSuccess(res, result);
  }
};
