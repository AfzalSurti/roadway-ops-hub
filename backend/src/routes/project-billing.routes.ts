import { Router } from "express";
import { projectBillingController } from "../controllers/project-billing.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { upsertBillingEntrySchema } from "../validators/project-billing.validator.js";

export const projectBillingRouter = Router();

projectBillingRouter.use(requireAuth);

projectBillingRouter.get(
  "/summary",
  requireRole("ADMIN", "HOD", "INFRA", "ACCOUNTS"),
  asyncHandler(projectBillingController.getSummary)
);
projectBillingRouter.get(
  "/project/:projectId",
  requireRole("ADMIN", "HOD", "INFRA", "ACCOUNTS"),
  asyncHandler(projectBillingController.listByProject)
);

projectBillingRouter.use(requireRole("ADMIN", "ACCOUNTS"));
projectBillingRouter.post(
  "/project/:projectId",
  validate(upsertBillingEntrySchema),
  asyncHandler(projectBillingController.create)
);
projectBillingRouter.patch("/:id", validate(upsertBillingEntrySchema), asyncHandler(projectBillingController.update));
projectBillingRouter.delete("/:id", asyncHandler(projectBillingController.remove));
