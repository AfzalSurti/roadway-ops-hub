import { Router } from "express";
import { financialController } from "../controllers/financial.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import { createRaBillSchema, updateRaBillSchema, upsertFinancialPlanSchema } from "../validators/project.validator.js";

export const financialRouter = Router();

financialRouter.use(requireAuth, requireRole("ADMIN"));
financialRouter.get("/bill-status/projects", asyncHandler(financialController.getAllProjectsBillStatus));
financialRouter.get("/projects", asyncHandler(financialController.listEligibleProjects));
financialRouter.get("/:projectId", asyncHandler(financialController.getProjectFinancial));
financialRouter.post("/:projectId/plan", validate(upsertFinancialPlanSchema), asyncHandler(financialController.upsertPlan));
financialRouter.post("/:projectId/ra-bills", validate(createRaBillSchema), asyncHandler(financialController.createRaBill));
financialRouter.patch("/ra-bills/:raBillId", validate(updateRaBillSchema), asyncHandler(financialController.updateRaBill));
