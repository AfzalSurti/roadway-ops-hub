import type { AuditAction, Prisma } from "@prisma/client";
import { auditRepository } from "../repositories/audit.repository.js";

export const auditService = {
  log(args: {
    action: AuditAction;
    actorId?: string;
    entityType: string;
    entityId: string;
    meta?: Prisma.InputJsonValue;
  }) {
    return auditRepository.create(args);
  }
};