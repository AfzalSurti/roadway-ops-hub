import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import type { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { unauthorized } from "./errors.js";

type TokenPayload = {
  sub: string;
  role: Role;
  email: string;
};

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  } catch {
    throw unauthorized("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    throw unauthorized("Invalid or expired refresh token");
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}