import type { Request, Response } from "express";
import { projectService } from "../services/project.service.js";
import { sendSuccess } from "../utils/response.js";

export const projectController = {
  async list(_req: Request, res: Response) {
    const projects = await projectService.list();
    return sendSuccess(res, projects);
  },
  async listWithoutNumber(_req: Request, res: Response) {
    const projects = await projectService.listWithoutNumber();
    return sendSuccess(res, projects);
  },
  async numberingOptions(_req: Request, res: Response) {
    const options = projectService.getNumberingOptions();
    return sendSuccess(res, options);
  },
  async previewProjectNumber(req: Request, res: Response) {
    const preview = await projectService.previewProjectNumber(req.body);
    return sendSuccess(res, preview);
  },
  async assignProjectNumber(req: Request, res: Response) {
    const project = await projectService.assignProjectNumber(req.params.id, req.body);
    return sendSuccess(res, project);
  },
  async create(req: Request, res: Response) {
    const project = await projectService.create(req.body);
    return sendSuccess(res, project, 201);
  },
  async update(req: Request, res: Response) {
    const project = await projectService.update(req.params.id, req.body);
    return sendSuccess(res, project);
  },
  async remove(req: Request, res: Response) {
    const result = await projectService.remove(req.params.id);
    return sendSuccess(res, result);
  }
};