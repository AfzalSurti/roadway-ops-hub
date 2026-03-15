import { Router } from "express";
import { financialController } from "../controllers/financial.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import { createFinancialBillsSchema, updateFinancialBillSchema, upsertFinancialPlanSchema } from "../validators/project.validator.js";

export const financialRouter = Router();

financialRouter.use(requireAuth, requireRole("ADMIN"));
financialRouter.get("/projects", asyncHandler(financialController.listEligibleProjects));
financialRouter.get("/:projectId", asyncHandler(financialController.getProjectFinancial));
financialRouter.post("/:projectId/plan", validate(upsertFinancialPlanSchema), asyncHandler(financialController.upsertPlan));
financialRouter.post("/:projectId/bills", validate(createFinancialBillsSchema), asyncHandler(financialController.createBills));
financialRouter.patch("/bills/:billId", validate(updateFinancialBillSchema), asyncHandler(financialController.updateBill));
