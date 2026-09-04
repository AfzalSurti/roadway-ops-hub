import { Router } from "express";
import { hoursController } from "../controllers/hours.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createLeaveRequestSchema,
  createOvertimeRequestSchema,
  reviewRequestSchema
} from "../validators/hours.validator.js";

export const hoursRouter = Router();

hoursRouter.use(requireAuth);

// Employee-facing — scoped to the authenticated user
hoursRouter.post(
  "/leave-requests",
  requireRole("EMPLOYEE"),
  validate(createLeaveRequestSchema),
  asyncHandler(hoursController.createLeaveRequest)
);
hoursRouter.get("/leave-requests/me", asyncHandler(hoursController.listMyLeaveRequests));

hoursRouter.post(
  "/overtime-requests",
  requireRole("EMPLOYEE"),
  validate(createOvertimeRequestSchema),
  asyncHandler(hoursController.createOvertimeRequest)
);
hoursRouter.get("/overtime-requests/me", asyncHandler(hoursController.listMyOvertimeRequests));

hoursRouter.get("/me/summary", asyncHandler(hoursController.getMySummary));

// Admin-facing
hoursRouter.use("/admin", requireRole("ADMIN"));

hoursRouter.get("/admin/requests", asyncHandler(hoursController.listAdminRequests));
hoursRouter.get("/admin/periods", asyncHandler(hoursController.listPeriods));
hoursRouter.get("/admin/report", asyncHandler(hoursController.getAllEmployeesReport));

hoursRouter.get("/admin/leave-requests", asyncHandler(hoursController.listAdminLeaveRequests));
hoursRouter.patch("/admin/leave-requests/:id/approve", asyncHandler(hoursController.approveLeaveRequest));
hoursRouter.patch(
  "/admin/leave-requests/:id/reject",
  validate(reviewRequestSchema),
  asyncHandler(hoursController.rejectLeaveRequest)
);

hoursRouter.get("/admin/overtime-requests", asyncHandler(hoursController.listAdminOvertimeRequests));
hoursRouter.patch("/admin/overtime-requests/:id/approve", asyncHandler(hoursController.approveOvertimeRequest));
hoursRouter.patch(
  "/admin/overtime-requests/:id/reject",
  validate(reviewRequestSchema),
  asyncHandler(hoursController.rejectOvertimeRequest)
);

hoursRouter.get("/admin/employees/:id/summary", asyncHandler(hoursController.getEmployeeSummary));
hoursRouter.get("/admin/employees/:id/breakdown", asyncHandler(hoursController.getEmployeeBreakdown));
hoursRouter.get("/admin/employees/:id/report", asyncHandler(hoursController.getEmployeeReport));
