import { Router } from "express";
import { infraController } from "../controllers/infra.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import {
  createInfraOtherCostSchema,
  createInfraTeamMemberSchema,
  createProjectAssignmentSchema,
  updateInfraOtherCostSchema,
  updateInfraTeamMemberSchema,
  updateProjectAssignmentSchema
} from "../validators/infra.validator.js";

export const infraRouter = Router();

infraRouter.use(requireAuth);

infraRouter.get("/overview", requireRole("ADMIN", "INFRA", "HOD"), asyncHandler(infraController.overview));
infraRouter.get("/projects", requireRole("ADMIN", "INFRA", "HOD"), asyncHandler(infraController.listProjects));
infraRouter.get("/projects/:id", requireRole("ADMIN", "INFRA", "HOD"), asyncHandler(infraController.getProject));
infraRouter.post("/projects/:id/assignments", requireRole("ADMIN", "INFRA"), validate(createProjectAssignmentSchema), asyncHandler(infraController.assignProject));
infraRouter.patch("/projects/:id/assignments/:assignmentId", requireRole("ADMIN", "INFRA"), validate(updateProjectAssignmentSchema), asyncHandler(infraController.updateAssignment));
infraRouter.post(
  "/projects/:id/other-costs",
  requireRole("ADMIN", "INFRA"),
  validate(createInfraOtherCostSchema),
  asyncHandler(infraController.createOtherCost)
);
infraRouter.patch(
  "/projects/:id/other-costs/:costId",
  requireRole("ADMIN", "INFRA"),
  validate(updateInfraOtherCostSchema),
  asyncHandler(infraController.updateOtherCost)
);
infraRouter.delete(
  "/projects/:id/other-costs/:costId",
  requireRole("ADMIN", "INFRA"),
  asyncHandler(infraController.removeOtherCost)
);
infraRouter.get("/team", requireRole("ADMIN", "INFRA", "HOD"), asyncHandler(infraController.listTeamMembers));
infraRouter.post("/team", requireRole("ADMIN", "INFRA"), validate(createInfraTeamMemberSchema), asyncHandler(infraController.createTeamMember));
infraRouter.patch("/team/:id", requireRole("ADMIN", "INFRA"), validate(updateInfraTeamMemberSchema), asyncHandler(infraController.updateTeamMember));
infraRouter.delete("/team/:id", requireRole("ADMIN", "INFRA"), asyncHandler(infraController.removeTeamMember));