import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import { createEmployeeSchema } from "../validators/user.validator.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN"));
usersRouter.post("/", validate(createEmployeeSchema), asyncHandler(userController.createEmployee));
usersRouter.get("/", asyncHandler(userController.listEmployees));
usersRouter.delete("/:id", asyncHandler(userController.deleteEmployee));