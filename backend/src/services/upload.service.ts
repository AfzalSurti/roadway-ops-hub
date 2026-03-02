import type { Express } from "express";
import { attachmentRepository } from "../repositories/attachment.repository.js";
import { auditService } from "./audit.service.js";
import { badRequest } from "../utils/errors.js";

export const uploadService = {
  async createAttachment(args: {
    file?: Express.Multer.File;
    uploadedById: string;
    taskId?: string;
    reportId?: string;
  }) {
    if (!args.file) {
      throw badRequest("No file uploaded");
    }

    const created = await attachmentRepository.create({
      fileName: args.file.filename,
      originalName: args.file.originalname,
      mimeType: args.file.mimetype,
      size: args.file.size,
      path: args.file.path,
      url: `/uploads/${args.file.filename}`,
      taskId: args.taskId,
      reportId: args.reportId,
      uploadedById: args.uploadedById
    });

    await auditService.log({
      action: "UPLOAD_ADDED",
      actorId: args.uploadedById,
      entityType: "Attachment",
      entityId: created.id,
      meta: { taskId: args.taskId, reportId: args.reportId }
    });

    return created;
  }
};