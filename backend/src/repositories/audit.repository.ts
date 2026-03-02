import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export const auditRepository = {
  create(data: {
    action: AuditAction;
    actorId?: string;
    entityType: string;
    entityId: string;
    meta?: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId,
        entityType: data.entityType,
        entityId: data.entityId,
        meta: data.meta
      }
    });
  }
};