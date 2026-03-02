import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../prisma/client.js";
import { forbidden, notFound, unauthorized } from "../utils/errors.js";

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw unauthorized();
    }

    if (req.user.role !== role) {
      throw forbidden("Insufficient permissions");
    }

    next();
  };
}

export function allowSelfOrAdmin(resource: "task" | "report") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const currentUser = req.user;
    if (!currentUser) {
      throw unauthorized();
    }

    if (currentUser.role === "ADMIN") {
      next();
      return;
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      throw forbidden("Missing resource id");
    }

    if (resource === "task") {
      const task = await prisma.task.findUnique({
        where: { id: resourceId },
        select: { id: true, assignedToId: true }
      });

      if (!task) {
        throw notFound("Task not found");
      }

      if (task.assignedToId !== currentUser.id) {
        throw forbidden("Task access denied");
      }
    }

    if (resource === "report") {
      const report = await prisma.report.findUnique({
        where: { id: resourceId },
        select: { id: true, submittedById: true }
      });

      if (!report) {
        throw notFound("Report not found");
      }

      if (report.submittedById !== currentUser.id) {
        throw forbidden("Report access denied");
      }
    }

    next();
  };
}