import type { Request, Response } from "express";
import { uploadService } from "../services/upload.service.js";
import { sendSuccess } from "../utils/response.js";

export const uploadController = {
  async upload(req: Request, res: Response) {
    const attachment = await uploadService.createAttachment({
      file: req.file,
      uploadedById: req.user!.id,
      taskId: typeof req.body.taskId === "string" ? req.body.taskId : undefined,
      reportId: typeof req.body.reportId === "string" ? req.body.reportId : undefined
    });

    return sendSuccess(res, {
      attachmentId: attachment.id,
      url: attachment.url,
      meta: {
        fileName: attachment.fileName,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size
      }
    }, 201);
  },

  async getFile(req: Request, res: Response) {
    const file = await uploadService.getFile(String(req.params.fileName ?? ""));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName)}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(file.data);
  }
};