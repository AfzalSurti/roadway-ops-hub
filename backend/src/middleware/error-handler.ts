import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): Response {
  if (error instanceof ZodError) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.flatten()
    });
  }

  if (error instanceof ApiError) {
    return sendError(res, error.statusCode, {
      code: error.code,
      message: error.message,
      details: error.details
    });
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled error");
  return sendError(res, 500, {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred"
  });
}