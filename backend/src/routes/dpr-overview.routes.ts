import { Router } from "express";
import { dprOverviewController } from "../controllers/dpr-overview.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createDprOverviewSchema, updateDprOverviewSchema } from "../validators/dpr-overview.validator.js";

export const dprOverviewRouter = Router();

dprOverviewRouter.use(requireAuth);

// List and read
dprOverviewRouter.get("/", requireRole("ADMIN", "PMO", "HOD"), asyncHandler(dprOverviewController.list));
dprOverviewRouter.get("/project/:projectId", requireRole("ADMIN", "PMO", "HOD"), asyncHandler(dprOverviewController.getByProject));

// Create/update/remove (HOD/PMO/Admin)
dprOverviewRouter.post("/", requireRole("ADMIN", "PMO", "HOD"), validate(createDprOverviewSchema), asyncHandler(dprOverviewController.create));
dprOverviewRouter.patch("/:id", requireRole("ADMIN", "PMO", "HOD"), validate(updateDprOverviewSchema), asyncHandler(dprOverviewController.update));
dprOverviewRouter.delete("/:id", requireRole("ADMIN", "PMO", "HOD"), asyncHandler(dprOverviewController.remove));
