import { Router } from "express";
import { subStaffController } from "../controllers/sub-staff.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  bulkImportSubStaffAssignmentsSchema,
  bulkReassignProjectSchema,
  bulkRenameDesignationSchema,
  clashSolutionSchema,
  confirmPlanDaySchema,
  generatePlanSchema,
  setPlanDaySchema,
  upsertSubStaffAssignmentSchema
} from "../validators/sub-staff.validator.js";

export const subStaffRouter = Router();

subStaffRouter.use(requireAuth);
subStaffRouter.use(requireRole("ADMIN", "ACCOUNTS"));

subStaffRouter.get("/", asyncHandler(subStaffController.list));
subStaffRouter.post("/", validate(upsertSubStaffAssignmentSchema), asyncHandler(subStaffController.create));
subStaffRouter.post(
  "/import",
  validate(bulkImportSubStaffAssignmentsSchema),
  asyncHandler(subStaffController.bulkImport)
);
subStaffRouter.get("/options", asyncHandler(subStaffController.getOptions));
subStaffRouter.get("/clashes", asyncHandler(subStaffController.getClashReport));
subStaffRouter.post(
  "/clashes/solution",
  validate(clashSolutionSchema),
  asyncHandler(subStaffController.getClashSolution)
);
subStaffRouter.get("/plan", asyncHandler(subStaffController.getPlanGrid));
subStaffRouter.post("/plan/generate", validate(generatePlanSchema), asyncHandler(subStaffController.generatePlan));
subStaffRouter.patch("/:id/plan", validate(setPlanDaySchema), asyncHandler(subStaffController.setPlanDay));
subStaffRouter.patch(
  "/:id/plan/confirm",
  validate(confirmPlanDaySchema),
  asyncHandler(subStaffController.confirmPlanDay)
);
subStaffRouter.post(
  "/reassign-project",
  validate(bulkReassignProjectSchema),
  asyncHandler(subStaffController.bulkReassignProject)
);
subStaffRouter.post(
  "/rename-designation",
  validate(bulkRenameDesignationSchema),
  asyncHandler(subStaffController.bulkRenameDesignation)
);
subStaffRouter.get("/:id/reassignment-suggestions", asyncHandler(subStaffController.getReassignmentSuggestions));
subStaffRouter.post("/:id/fill-open-slot", asyncHandler(subStaffController.fillOpenSlot));
subStaffRouter.patch("/:id", validate(upsertSubStaffAssignmentSchema), asyncHandler(subStaffController.update));
subStaffRouter.delete("/:id", asyncHandler(subStaffController.remove));
