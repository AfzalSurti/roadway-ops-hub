import { Router } from "express";
import { operationsController } from "../controllers/operations.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createPreContractSchema, updatePreContractSchema } from "../validators/operations.validator.js";

export const operationsRouter = Router();

operationsRouter.use(requireAuth);

operationsRouter.get("/", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(operationsController.list));
operationsRouter.get("/by-tender/:tenderBidId", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(operationsController.getByTenderBidId));
operationsRouter.get("/:id", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(operationsController.getById));
operationsRouter.post("/", requireRole("OPERATIONS", "TENDER", "ADMIN"), validate(createPreContractSchema), asyncHandler(operationsController.create));
operationsRouter.patch("/:id", requireRole("OPERATIONS", "TENDER", "ADMIN"), validate(updatePreContractSchema), asyncHandler(operationsController.update));
operationsRouter.delete("/:id", requireRole("OPERATIONS", "ADMIN"), asyncHandler(operationsController.remove));
