import { Router } from "express";
import { uploadController } from "../controllers/upload.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/async-handler.js";

export const uploadsRouter = Router();

// Public file serve (bytes live in DB so Render restarts don't break links)
uploadsRouter.get("/:fileName", asyncHandler(uploadController.getFile));

uploadsRouter.post("/", requireAuth, upload.single("file"), asyncHandler(uploadController.upload));