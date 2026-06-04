import { Router } from "express";
import { expenseController } from "../controllers/expense.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";
import {
  createExpenseEntrySchema,
  createExpenseSheetSchema,
  reviewExpenseSheetSchema,
  updateExpenseEntrySchema,
  updateExpenseSheetSchema
} from "../validators/expense.validator.js";

export const expenseRouter = Router();

expenseRouter.use(requireAuth);

expenseRouter.get("/categories", asyncHandler(expenseController.listCategories));
expenseRouter.get("/dashboard", asyncHandler(expenseController.dashboard));

expenseRouter.get("/sheets", asyncHandler(expenseController.listSheets));
expenseRouter.get("/sheets/:id", asyncHandler(expenseController.getSheet));
expenseRouter.post(
  "/sheets",
  requireRole("EMPLOYEE", "ADMIN"),
  validate(createExpenseSheetSchema),
  asyncHandler(expenseController.createSheet)
);
expenseRouter.patch(
  "/sheets/:id",
  requireRole("EMPLOYEE", "ADMIN"),
  validate(updateExpenseSheetSchema),
  asyncHandler(expenseController.updateSheet)
);
expenseRouter.delete("/sheets/:id", requireRole("EMPLOYEE", "ADMIN"), asyncHandler(expenseController.deleteSheet));
expenseRouter.post("/sheets/:id/submit", requireRole("EMPLOYEE"), asyncHandler(expenseController.submitSheet));
expenseRouter.post(
  "/sheets/:id/review",
  requireRole("ADMIN"),
  validate(reviewExpenseSheetSchema),
  asyncHandler(expenseController.reviewSheet)
);

expenseRouter.post(
  "/sheets/:sheetId/entries",
  requireRole("EMPLOYEE", "ADMIN"),
  validate(createExpenseEntrySchema),
  asyncHandler(expenseController.addEntry)
);
expenseRouter.patch(
  "/entries/:entryId",
  requireRole("EMPLOYEE", "ADMIN"),
  validate(updateExpenseEntrySchema),
  asyncHandler(expenseController.updateEntry)
);
expenseRouter.delete("/entries/:entryId", requireRole("EMPLOYEE", "ADMIN"), asyncHandler(expenseController.deleteEntry));

expenseRouter.get("/vouchers", asyncHandler(expenseController.listVouchers));
