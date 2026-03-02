import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { unauthorized } from "../utils/errors.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw unauthorized("Missing Bearer token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
}