import { Router } from "express";
import { templateController } from "../controllers/template.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createTemplateSchema, updateTemplateSchema } from "../validators/template.validator.js";

export const templatesRouter = Router();

templatesRouter.use(requireAuth, requireRole("ADMIN"));

templatesRouter.post("/", validate(createTemplateSchema), asyncHandler(templateController.create));
templatesRouter.get("/", asyncHandler(templateController.list));
templatesRouter.get("/:id", asyncHandler(templateController.getById));
templatesRouter.patch("/:id", validate(updateTemplateSchema), asyncHandler(templateController.update));
templatesRouter.delete("/:id", asyncHandler(templateController.remove));