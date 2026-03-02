import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import { authRateLimiter } from "../middleware/rate-limit.js";
import { loginSchema, refreshSchema } from "../validators/auth.validator.js";

export const authRouter = Router();

authRouter.use(authRateLimiter);
authRouter.post("/login", validate(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", validate(refreshSchema), asyncHandler(authController.refresh));
authRouter.post("/logout", validate(refreshSchema), asyncHandler(authController.logout));