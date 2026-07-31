import type { Express } from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { attachmentRepository } from "../repositories/attachment.repository.js";
import { auditService } from "./audit.service.js";
import { logger } from "../config/logger.js";
import { badRequest, notFound } from "../utils/errors.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
/** Keep PDFs small enough for reliable remote BYTEA writes. */
const MAX_PERSIST_BYTES = 5 * 1024 * 1024;

function safeFileName(raw: string) {
  const base = path.basename(raw);
  if (!base || base !== raw.replace(/\\/g, "/").split("/").pop()) {
    throw badRequest("Invalid file name");
  }
  return base;
}

function resolveMimeType(file: Express.Multer.File) {
  if (file.mimetype && file.mimetype !== "application/octet-stream") {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname || file.filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return file.mimetype || "application/octet-stream";
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

    if (args.file.size > MAX_PERSIST_BYTES) {
      throw badRequest("Attachment must be 5 MB or smaller (compress the PDF and retry)");
    }

    // PDFs are binary — store raw bytes in Postgres BYTEA (Prisma Bytes).
    // Await the write so viewing works after Render restarts (ephemeral disk).
    const data = args.file.buffer?.length
      ? Buffer.from(args.file.buffer)
      : await fs.readFile(args.file.path);

    const mimeType = resolveMimeType(args.file);

    const created = await attachmentRepository.create({
      fileName: args.file.filename,
      originalName: args.file.originalname,
      mimeType,
      size: args.file.size,
      path: args.file.path,
      url: `/uploads/${args.file.filename}`,
      data,
      taskId: args.taskId,
      reportId: args.reportId,
      uploadedById: args.uploadedById
    });

    void auditService
      .log({
        action: "UPLOAD_ADDED",
        actorId: args.uploadedById,
        entityType: "Attachment",
        entityId: created.id,
        meta: { taskId: args.taskId, reportId: args.reportId, mimeType, size: args.file.size }
      })
      .catch((error) => logger.error({ err: error }, "Failed to write upload audit log"));

    return created;
  },

  async getFile(fileNameRaw: string) {
    const fileName = safeFileName(fileNameRaw);
    const attachment = await attachmentRepository.findByFileName(fileName);

    if (attachment?.data && attachment.data.length > 0) {
      return {
        data: Buffer.from(attachment.data),
        mimeType: attachment.mimeType || "application/pdf",
        originalName: attachment.originalName
      };
    }

    const diskPath = attachment?.path && fsSync.existsSync(attachment.path)
      ? attachment.path
      : path.join(uploadDir, fileName);

    if (!fsSync.existsSync(diskPath)) {
      throw notFound("File not found — please re-upload the attachment");
    }

    return {
      data: fsSync.readFileSync(diskPath),
      mimeType: attachment?.mimeType || "application/pdf",
      originalName: attachment?.originalName || fileName
    };
  }
};
