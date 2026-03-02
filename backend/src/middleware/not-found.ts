import type { Request, Response } from "express";
import { sendError } from "../utils/response.js";

export function notFoundHandler(_req: Request, res: Response): Response {
  return sendError(res, 404, {
    code: "NOT_FOUND",
    message: "Route not found"
  });
}