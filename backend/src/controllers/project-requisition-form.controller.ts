import type { Request, Response } from "express";
import { projectRequisitionFormService } from "../services/project-requisition-form.service.js";
import { sendSuccess } from "../utils/response.js";

export const projectRequisitionFormController = {
  async list(_req: Request, res: Response) {
    const forms = await projectRequisitionFormService.list();
    return sendSuccess(res, forms);
  },
  async getByProjectId(req: Request, res: Response) {
    const form = await projectRequisitionFormService.getByProjectId(req.params.projectId);
    return sendSuccess(res, form);
  },
  async upsert(req: Request, res: Response) {
    const form = await projectRequisitionFormService.upsert(req.params.projectId, req.body);
    return sendSuccess(res, form);
  }
};