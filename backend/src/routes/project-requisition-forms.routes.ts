import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { projectRequisitionFormController } from "../controllers/project-requisition-form.controller.js";
import { upsertProjectRequisitionFormSchema } from "../validators/project-requisition-form.validator.js";

export const projectRequisitionFormsRouter = Router();

projectRequisitionFormsRouter.use(requireAuth);
projectRequisitionFormsRouter.get("/", requireRole("ADMIN", "PMO"), asyncHandler(projectRequisitionFormController.list));
projectRequisitionFormsRouter.get("/:projectId", requireRole("ADMIN", "PMO"), asyncHandler(projectRequisitionFormController.getByProjectId));
projectRequisitionFormsRouter.post("/:projectId", requireRole("ADMIN", "PMO"), validate(upsertProjectRequisitionFormSchema), asyncHandler(projectRequisitionFormController.upsert));
