import { Router } from "express";
import { contractController } from "../controllers/contract.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createContractSchema, updateContractSchema } from "../validators/contract.validator.js";

export const contractRouter = Router();

contractRouter.use(requireAuth);

contractRouter.get("/", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(contractController.list));
contractRouter.get("/by-tender/:tenderBidId", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(contractController.getByTenderBidId));
contractRouter.get("/:id", requireRole("OPERATIONS", "TENDER", "ADMIN", "HOD"), asyncHandler(contractController.getById));
contractRouter.post("/", requireRole("OPERATIONS", "TENDER", "ADMIN"), validate(createContractSchema), asyncHandler(contractController.create));
contractRouter.patch("/:id", requireRole("OPERATIONS", "TENDER", "ADMIN"), validate(updateContractSchema), asyncHandler(contractController.update));
contractRouter.delete("/:id", requireRole("OPERATIONS", "ADMIN"), asyncHandler(contractController.remove));
