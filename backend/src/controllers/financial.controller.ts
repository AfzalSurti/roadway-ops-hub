import type { Request, Response } from "express";
import { financialService } from "../services/financial.service.js";
import { sendSuccess } from "../utils/response.js";

export const financialController = {
  async listEligibleProjects(_req: Request, res: Response) {
    const projects = await financialService.listEligibleProjects();
    return sendSuccess(res, projects);
  },

  async getProjectFinancial(req: Request, res: Response) {
    const detail = await financialService.getProjectFinancial(req.params.projectId);
    return sendSuccess(res, detail);
  },

  async upsertPlan(req: Request, res: Response) {
    const plan = await financialService.upsertPlan(req.params.projectId, req.body);
    return sendSuccess(res, plan);
  },

  async createBills(req: Request, res: Response) {
    const plan = await financialService.createBills(req.params.projectId, req.body);
    return sendSuccess(res, plan, 201);
  },

  async updateBill(req: Request, res: Response) {
    const bill = await financialService.updateBill(req.params.billId, req.body);
    return sendSuccess(res, bill);
  }
};
