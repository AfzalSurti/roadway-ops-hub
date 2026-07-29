import { Router } from "express";
import { tenderController } from "../controllers/tender.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createTenderBidSchema, updateTenderBidSchema } from "../validators/tender.validator.js";

export const tenderRouter = Router();

tenderRouter.use(requireAuth);

tenderRouter.get("/", requireRole("TENDER", "ADMIN", "HOD"), asyncHandler(tenderController.list));
tenderRouter.get("/:id", requireRole("TENDER", "ADMIN", "HOD"), asyncHandler(tenderController.getById));
tenderRouter.post("/", requireRole("TENDER", "ADMIN"), validate(createTenderBidSchema), asyncHandler(tenderController.create));
tenderRouter.patch("/:id", requireRole("TENDER", "ADMIN"), validate(updateTenderBidSchema), asyncHandler(tenderController.update));
tenderRouter.delete("/:id", requireRole("TENDER", "ADMIN"), asyncHandler(tenderController.remove));
