import { Router } from "express";
import { projectController } from "../controllers/project.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createProjectSchema } from "../validators/project.validator.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.get("/", asyncHandler(projectController.list));
projectsRouter.post("/", requireRole("ADMIN"), validate(createProjectSchema), asyncHandler(projectController.create));