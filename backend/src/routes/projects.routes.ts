import { Router } from "express";
import { projectController } from "../controllers/project.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { assignProjectNumberSchema, createProjectSchema, previewProjectNumberSchema } from "../validators/project.validator.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.get("/", asyncHandler(projectController.list));
projectsRouter.get("/without-number", requireRole("ADMIN"), asyncHandler(projectController.listWithoutNumber));
projectsRouter.get("/numbering-options", requireRole("ADMIN"), asyncHandler(projectController.numberingOptions));
projectsRouter.post("/preview-number", requireRole("ADMIN"), validate(previewProjectNumberSchema), asyncHandler(projectController.previewProjectNumber));
projectsRouter.post("/number-preview", requireRole("ADMIN"), validate(previewProjectNumberSchema), asyncHandler(projectController.previewProjectNumber));
projectsRouter.post("/:id/assign-number", requireRole("ADMIN"), validate(assignProjectNumberSchema), asyncHandler(projectController.assignProjectNumber));
projectsRouter.post("/assign-number/:id", requireRole("ADMIN"), validate(assignProjectNumberSchema), asyncHandler(projectController.assignProjectNumber));
projectsRouter.post("/", requireRole("ADMIN"), validate(createProjectSchema), asyncHandler(projectController.create));
projectsRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(projectController.remove));