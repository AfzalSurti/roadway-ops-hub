import { Router } from "express";
import { letterNumberingController } from "../controllers/letter-numbering.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import {
  createLetterEntrySchema,
  createLetterProjectSchema,
  bulkImportLettersSchema,
  employeeActionSubmitSchema,
  importLetterProjectSchema,
  insertLetterEntrySchema,
  letterActionReviewSchema,
  updateLetterEntrySchema,
  updateLetterProjectSchema
} from "../validators/letter-numbering.validator.js";

export const letterNumberingRouter = Router();

// Employee-facing: any authenticated user manages only letters referred to themselves.
letterNumberingRouter.get(
  "/my/pending-replies",
  requireAuth,
  asyncHandler(letterNumberingController.listMyPendingReplies)
);
letterNumberingRouter.patch(
  "/my/letters/:letterId/submit",
  requireAuth,
  validate(employeeActionSubmitSchema),
  asyncHandler(letterNumberingController.submitMyLetterAction)
);

letterNumberingRouter.use(requireAuth, requireRole("ADMIN", "PMO"));

letterNumberingRouter.get("/projects", asyncHandler(letterNumberingController.listProjects));
letterNumberingRouter.get("/pending-replies", asyncHandler(letterNumberingController.listPendingReplies));
letterNumberingRouter.get("/employees", asyncHandler(letterNumberingController.listEmployees));
letterNumberingRouter.get("/main-projects", asyncHandler(letterNumberingController.listMainProjects));
letterNumberingRouter.get("/suggestions", asyncHandler(letterNumberingController.suggestions));
letterNumberingRouter.post(
  "/projects/import",
  validate(importLetterProjectSchema),
  asyncHandler(letterNumberingController.importFromMainProject)
);
letterNumberingRouter.post(
  "/projects",
  validate(createLetterProjectSchema),
  asyncHandler(letterNumberingController.createProject)
);
letterNumberingRouter.get("/projects/:id", asyncHandler(letterNumberingController.getProject));
letterNumberingRouter.post("/projects/:id/sync-to-main", asyncHandler(letterNumberingController.syncToMainProject));
letterNumberingRouter.patch(
  "/projects/:id",
  validate(updateLetterProjectSchema),
  asyncHandler(letterNumberingController.updateProject)
);
letterNumberingRouter.delete("/projects/:id", asyncHandler(letterNumberingController.removeProject));

letterNumberingRouter.get("/projects/:id/letters", asyncHandler(letterNumberingController.listLetters));
letterNumberingRouter.post(
  "/projects/:id/letters",
  validate(createLetterEntrySchema),
  asyncHandler(letterNumberingController.addLetter)
);
letterNumberingRouter.post(
  "/projects/:id/letters/bulk",
  validate(bulkImportLettersSchema),
  asyncHandler(letterNumberingController.bulkImportLetters)
);
letterNumberingRouter.post(
  "/projects/:id/letters/insert",
  validate(insertLetterEntrySchema),
  asyncHandler(letterNumberingController.insertLetter)
);
letterNumberingRouter.patch(
  "/letters/:letterId",
  validate(updateLetterEntrySchema),
  asyncHandler(letterNumberingController.updateLetter)
);
letterNumberingRouter.patch(
  "/letters/:letterId/review",
  validate(letterActionReviewSchema),
  asyncHandler(letterNumberingController.reviewLetterAction)
);
letterNumberingRouter.delete("/letters/:letterId", asyncHandler(letterNumberingController.removeLetter));
