import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { sendSuccess } from "../utils/response.js";

function serializeUser(user: {
  id: string; name: string; email: string; role: string;
  contactNumber?: string | null; education?: string | null;
  dateOfJoining?: Date | null; experienceInOrg?: string | null;
  currentCtc?: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    contactNumber: user.contactNumber ?? null,
    education: user.education ?? null,
    dateOfJoining: user.dateOfJoining ? user.dateOfJoining.toISOString() : null,
    experienceInOrg: user.experienceInOrg ?? null,
    currentCtc: user.currentCtc ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export const userController = {
  async getProfile(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const user = await userService.getProfile(userId);
    return sendSuccess(res, serializeUser(user));
  },
  async updateProfile(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const user = await userService.updateProfile(userId, req.body);
    return sendSuccess(res, serializeUser(user));
  },
  async createEmployee(req: Request, res: Response) {
    const user = await userService.createEmployee(req.body);
    return sendSuccess(res, serializeUser(user), 201);
  },
  async listEmployees(_req: Request, res: Response) {
    const users = await userService.listEmployees();
    return sendSuccess(res, users.map(serializeUser));
  },
  async deleteEmployee(req: Request, res: Response) {
    const result = await userService.deleteEmployee(req.params.id);
    return sendSuccess(res, result);
  }
};