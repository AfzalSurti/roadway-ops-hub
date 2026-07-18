import type { Request, Response } from "express";
import { infraService } from "../services/infra.service.js";
import { sendSuccess } from "../utils/response.js";

export const infraController = {
  async overview(_req: Request, res: Response) {
    return sendSuccess(res, await infraService.overview());
  },
  async listProjects(_req: Request, res: Response) {
    return sendSuccess(res, await infraService.listProjects());
  },
  async getProject(req: Request, res: Response) {
    return sendSuccess(res, await infraService.getProject(req.params.id));
  },
  async listTeamMembers(_req: Request, res: Response) {
    return sendSuccess(res, await infraService.listTeamMembers());
  },
  async createTeamMember(req: Request, res: Response) {
    return sendSuccess(res, await infraService.createTeamMember(req.body), 201);
  },
  async updateTeamMember(req: Request, res: Response) {
    return sendSuccess(res, await infraService.updateTeamMember(req.params.id, req.body));
  },
  async removeTeamMember(req: Request, res: Response) {
    return sendSuccess(res, await infraService.removeTeamMember(req.params.id));
  },
  async assignProject(req: Request, res: Response) {
    return sendSuccess(res, await infraService.assignProject(req.params.id, req.body), 201);
  },
  async updateAssignment(req: Request, res: Response) {
    return sendSuccess(res, await infraService.updateAssignment(req.params.assignmentId, req.body));
  },
  async createOtherCost(req: Request, res: Response) {
    return sendSuccess(res, await infraService.createOtherCost(req.params.id, req.body), 201);
  },
  async updateOtherCost(req: Request, res: Response) {
    return sendSuccess(res, await infraService.updateOtherCost(req.params.costId, req.body));
  },
  async removeOtherCost(req: Request, res: Response) {
    return sendSuccess(res, await infraService.removeOtherCost(req.params.costId));
  }
};