import { Router } from "express";
import { assetController } from "../controllers/asset.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { addMaintenanceSchema, addMovementSchema, createAssetSchema, updateAssetSchema } from "../validators/asset.validator.js";

export const assetRouter = Router();

assetRouter.use(requireAuth);

assetRouter.get("/stats", requireRole("PMO", "ADMIN"), asyncHandler(assetController.getStats));
assetRouter.get("/", requireRole("PMO", "ADMIN"), asyncHandler(assetController.list));
assetRouter.get("/:id", requireRole("PMO", "ADMIN"), asyncHandler(assetController.getById));
assetRouter.post("/", requireRole("PMO", "ADMIN"), validate(createAssetSchema), asyncHandler(assetController.create));
assetRouter.patch("/:id", requireRole("PMO", "ADMIN"), validate(updateAssetSchema), asyncHandler(assetController.update));
assetRouter.delete("/:id", requireRole("PMO"), asyncHandler(assetController.remove));
assetRouter.post("/:id/movements", requireRole("PMO", "ADMIN"), validate(addMovementSchema), asyncHandler(assetController.addMovement));
assetRouter.post("/:id/maintenances", requireRole("PMO", "ADMIN"), validate(addMaintenanceSchema), asyncHandler(assetController.addMaintenance));
