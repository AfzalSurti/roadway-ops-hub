import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { sendSuccess } from "../utils/response.js";

export const userController = {
  async createEmployee(req: Request, res: Response) {
    const user = await userService.createEmployee(req.body);
    return sendSuccess(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 201);
  },
  async listEmployees(_req: Request, res: Response) {
    const users = await userService.listEmployees();
    return sendSuccess(res, users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })));
  }
};