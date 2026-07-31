import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { attachmentRepository } from "../repositories/attachment.repository.js";
import { auditService } from "./audit.service.js";
import { badRequest, notFound } from "../utils/errors.js";

const uploadDir = path.resolve(process.cwd(), "uploads");

function safeFileName(raw: string) {
  const base = path.basename(raw);
  if (!base || base !== raw.replace(/\\/g, "/").split("/").pop()) {
    throw badRequest("Invalid file name");
  }
  return base;
}

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

    const data = args.file.buffer?.length
      ? args.file.buffer
      : fs.readFileSync(args.file.path);

    const created = await attachmentRepository.create({
      fileName: args.file.filename,
      originalName: args.file.originalname,
      mimeType: args.file.mimetype,
      size: args.file.size,
      path: args.file.path,
      url: `/uploads/${args.file.filename}`,
      data,
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
  },

  async getFile(fileNameRaw: string) {
    const fileName = safeFileName(fileNameRaw);
    const attachment = await attachmentRepository.findByFileName(fileName);

    if (attachment?.data) {
      return {
        data: Buffer.from(attachment.data),
        mimeType: attachment.mimeType,
        originalName: attachment.originalName
      };
    }

    const diskPath = attachment?.path && fs.existsSync(attachment.path)
      ? attachment.path
      : path.join(uploadDir, fileName);

    if (!fs.existsSync(diskPath)) {
      throw notFound("File not found");
    }

    return {
      data: fs.readFileSync(diskPath),
      mimeType: attachment?.mimeType || "application/octet-stream",
      originalName: attachment?.originalName || fileName
    };
  }
};