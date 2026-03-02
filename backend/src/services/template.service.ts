import type { Prisma } from "@prisma/client";
import { templateRepository } from "../repositories/template.repository.js";
import { notFound } from "../utils/errors.js";
import { auditService } from "./audit.service.js";

export const templateService = {
  create(payload: { name: string; description?: string; fields: unknown[] }, actorId: string) {
    return templateRepository.create({
      name: payload.name,
      description: payload.description,
      fields: payload.fields as Prisma.InputJsonValue
    }).then(async (template) => {
      await auditService.log({
        action: "TEMPLATE_UPDATED",
        actorId,
        entityType: "ReportTemplate",
        entityId: template.id,
        meta: { action: "create" }
      });
      return template;
    });
  },
  list() {
    return templateRepository.findMany();
  },
  async getById(id: string) {
    const template = await templateRepository.findById(id);
    if (!template) {
      throw notFound("Template not found");
    }
    return template;
  },
  async update(id: string, payload: { name?: string; description?: string; fields?: unknown[] }, actorId: string) {
    await this.getById(id);
    const updated = await templateRepository.update(id, {
      ...payload,
      fields: payload.fields ? (payload.fields as Prisma.InputJsonValue) : undefined
    });
    await auditService.log({
      action: "TEMPLATE_UPDATED",
      actorId,
      entityType: "ReportTemplate",
      entityId: id,
      meta: { action: "update" }
    });
    return updated;
  },
  async remove(id: string) {
    await this.getById(id);
    return templateRepository.delete(id);
  }
};