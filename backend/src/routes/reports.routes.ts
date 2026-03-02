import { Router } from "express";
import { reportController } from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { allowSelfOrAdmin, requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createReportSchema, updateReportFeedbackSchema, updateReportStatusSchema } from "../validators/report.validator.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.post("/", requireRole("EMPLOYEE"), validate(createReportSchema), asyncHandler(reportController.create));
reportsRouter.get("/", asyncHandler(reportController.list));
reportsRouter.get("/:id", asyncHandler(allowSelfOrAdmin("report")), asyncHandler(reportController.getById));
reportsRouter.patch(
  "/:id/status",
  requireRole("ADMIN"),
  validate(updateReportStatusSchema),
  asyncHandler(reportController.updateStatus)
);
reportsRouter.patch(
  "/:id/feedback",
  requireRole("ADMIN"),
  validate(updateReportFeedbackSchema),
  asyncHandler(reportController.updateFeedback)
);