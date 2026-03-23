import { Router } from "express";
import { assistantController } from "../controllers/assistant.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { chatAssistantSchema } from "../validators/assistant.validator.js";

export const assistantRouter = Router();

assistantRouter.use(requireAuth);
assistantRouter.post("/chat", validate(chatAssistantSchema), asyncHandler(assistantController.chat));
