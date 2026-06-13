import { Router } from "express";
import { projectController } from "../controllers/project.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { bulkImportProjectsSchema } from "../validators/project-import.validator.js";
import { assignProjectNumberSchema, createProjectSchema, previewProjectNumberSchema, updateProjectSchema } from "../validators/project.validator.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.get("/", asyncHandler(projectController.list));
projectsRouter.get("/without-number", requireRole("ADMIN", "PMO"), asyncHandler(projectController.listWithoutNumber));
projectsRouter.get("/numbering-options", requireRole("ADMIN", "PMO"), asyncHandler(projectController.numberingOptions));
projectsRouter.post("/preview-number", requireRole("ADMIN", "PMO"), validate(previewProjectNumberSchema), asyncHandler(projectController.previewProjectNumber));
projectsRouter.post("/number-preview", requireRole("ADMIN", "PMO"), validate(previewProjectNumberSchema), asyncHandler(projectController.previewProjectNumber));
projectsRouter.post("/:id/assign-number", requireRole("ADMIN", "PMO"), validate(assignProjectNumberSchema), asyncHandler(projectController.assignProjectNumber));
projectsRouter.post("/assign-number/:id", requireRole("ADMIN", "PMO"), validate(assignProjectNumberSchema), asyncHandler(projectController.assignProjectNumber));
projectsRouter.post("/:id/project-number", requireRole("ADMIN", "PMO"), validate(assignProjectNumberSchema), asyncHandler(projectController.assignProjectNumber));
projectsRouter.post("/import", requireRole("ADMIN", "PMO"), validate(bulkImportProjectsSchema), asyncHandler(projectController.bulkImport));
projectsRouter.post("/", requireRole("ADMIN", "PMO"), validate(createProjectSchema), asyncHandler(projectController.create));
projectsRouter.patch("/:id", requireRole("ADMIN", "PMO"), validate(updateProjectSchema), asyncHandler(projectController.update));
projectsRouter.delete("/:id", requireRole("ADMIN", "PMO"), asyncHandler(projectController.remove));