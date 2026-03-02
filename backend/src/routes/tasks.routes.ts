import { Router } from "express";
import { taskController } from "../controllers/task.controller.js";
import { commentController } from "../controllers/comment.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { allowSelfOrAdmin, requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createCommentSchema } from "../validators/comment.validator.js";
import { createTaskSchema, employeeTaskUpdateSchema, updateTaskSchema } from "../validators/task.validator.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.post("/", requireRole("ADMIN"), validate(createTaskSchema), asyncHandler(taskController.create));
tasksRouter.get("/", asyncHandler(taskController.list));
tasksRouter.get("/:id", asyncHandler(allowSelfOrAdmin("task")), asyncHandler(taskController.getById));
tasksRouter.patch(
  "/:id",
  asyncHandler(async (req, _res, next) => {
    if (req.user?.role === "ADMIN") {
      req.body = updateTaskSchema.parse(req.body);
    } else {
      req.body = employeeTaskUpdateSchema.parse(req.body);
    }
    next();
  }),
  asyncHandler(allowSelfOrAdmin("task")),
  asyncHandler(taskController.update)
);
tasksRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(taskController.remove));

tasksRouter.post("/:id/comments", validate(createCommentSchema), asyncHandler(commentController.create));
tasksRouter.get("/:id/comments", asyncHandler(commentController.list));