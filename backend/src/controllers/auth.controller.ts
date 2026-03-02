import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { sendSuccess } from "../utils/response.js";

export const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body.email, req.body.password);
    return sendSuccess(res, result);
  },
  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    return sendSuccess(res, result);
  },
  async logout(req: Request, res: Response) {
    const result = await authService.logout(req.body.refreshToken);
    return sendSuccess(res, result);
  }
};