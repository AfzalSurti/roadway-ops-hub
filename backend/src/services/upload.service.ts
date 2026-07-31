import type { Express } from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { attachmentRepository } from "../repositories/attachment.repository.js";
import { auditService } from "./audit.service.js";
import { logger } from "../config/logger.js";
import { badRequest, notFound } from "../utils/errors.js";

const uploadDir = path.resolve(process.cwd(), "uploads");

function safeFileName(raw: string) {
  const base = path.basename(raw);
  if (!base || base !== raw.replace(/\\/g, "/").split("/").pop()) {
    throw badRequest("Invalid file name");
  }
  return base;
}

async function persistBytesInBackground(attachmentId: string, file: Express.Multer.File) {
  try {
    const data = file.buffer?.length ? file.buffer : await fs.readFile(file.path);
    await attachmentRepository.updateData(attachmentId, data);
  } catch (error) {
    logger.error({ err: error, attachmentId }, "Failed to persist attachment bytes");
  }
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

    // Fast path: save metadata (+ disk file from multer). Persist DB bytes in background
    // so the client is not blocked by a large remote BYTEA write.
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

    void persistBytesInBackground(created.id, args.file);

    void auditService
      .log({
        action: "UPLOAD_ADDED",
        actorId: args.uploadedById,
        entityType: "Attachment",
        entityId: created.id,
        meta: { taskId: args.taskId, reportId: args.reportId }
      })
      .catch((error) => logger.error({ err: error }, "Failed to write upload audit log"));

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

    const diskPath = attachment?.path && fsSync.existsSync(attachment.path)
      ? attachment.path
      : path.join(uploadDir, fileName);

    if (!fsSync.existsSync(diskPath)) {
      throw notFound("File not found");
    }

    return {
      data: fsSync.readFileSync(diskPath),
      mimeType: attachment?.mimeType || "application/octet-stream",
      originalName: attachment?.originalName || fileName
    };
  }
};
