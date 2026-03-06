import { Router } from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", asyncHandler(notificationController.list));
notificationsRouter.patch("/:id/read", asyncHandler(notificationController.markRead));
notificationsRouter.patch("/read-all", asyncHandler(notificationController.markAllRead));
