import { Router } from "express";
import { uploadController } from "../controllers/upload.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/async-handler.js";

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);
uploadsRouter.post("/", upload.single("file"), asyncHandler(uploadController.upload));