import type { Request, Response } from "express";
import { assistantService } from "../services/assistant.service.js";
import { sendSuccess } from "../utils/response.js";

export const assistantController = {
  async chat(req: Request, res: Response) {
    const result = await assistantService.chat({
      user: req.user!,
      message: req.body.message,
      conversation: req.body.conversation ?? []
    });

    return sendSuccess(res, result);
  }
};
