import type { Request, Response } from "express";
import { projectService } from "../services/project.service.js";
import { sendSuccess } from "../utils/response.js";

export const projectController = {
  async list(_req: Request, res: Response) {
    const projects = await projectService.list();
    return sendSuccess(res, projects);
  },
  async create(req: Request, res: Response) {
    const project = await projectService.create(req.body);
    return sendSuccess(res, project, 201);
  }
};