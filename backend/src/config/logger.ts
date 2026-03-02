import pino from "pino";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug"
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: any, res: any) => {
    const existing = req.headers["x-request-id"];
    const requestId = typeof existing === "string" && existing.trim().length > 0 ? existing : randomUUID();
    res.setHeader("x-request-id", requestId);
    return requestId;
  },
  customProps: (req: any) => ({
    requestId: req.id
  })
});