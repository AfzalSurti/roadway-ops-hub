import type { Request, Response } from "express";
import { commentService } from "../services/comment.service.js";
import { sendSuccess } from "../utils/response.js";

export const commentController = {
  async create(req: Request, res: Response) {
    const result = await commentService.create(req.params.id, req.body.body, req.user!);
    return sendSuccess(res, result, 201);
  },
  async list(req: Request, res: Response) {
    const result = await commentService.list(req.params.id, req.user!);
    return sendSuccess(res, result);
  }
};