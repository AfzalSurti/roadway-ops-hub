import type { Request, Response } from "express";
import { expenseService } from "../services/expense.service.js";
import { sendSuccess } from "../utils/response.js";

function parseDateQuery(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const expenseController = {
  async listCategories(_req: Request, res: Response) {
    const result = await expenseService.listCategories();
    return sendSuccess(res, result);
  },

  async dashboard(req: Request, res: Response) {
    const result = await expenseService.getDashboard(req.user!);
    return sendSuccess(res, result);
  },

  async listSheets(req: Request, res: Response) {
    const result = await expenseService.listSheets(
      req.user!,
      {
        employeeId: req.query.employeeId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        siteName: req.query.siteName as string | undefined,
        status: req.query.status as never,
        categoryId: req.query.categoryId as string | undefined,
        billAvailable: req.query.billAvailable === "true" ? true : req.query.billAvailable === "false" ? false : undefined,
        dateFrom: parseDateQuery(req.query.dateFrom as string | undefined),
        dateTo: parseDateQuery(req.query.dateTo as string | undefined),
        search: req.query.search as string | undefined
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  },

  async getSheet(req: Request, res: Response) {
    const result = await expenseService.getSheetById(req.params.id, req.user!);
    return sendSuccess(res, result);
  },

  async createSheet(req: Request, res: Response) {
    const result = await expenseService.createSheet(req.user!, req.body);
    return sendSuccess(res, result, 201);
  },

  async updateSheet(req: Request, res: Response) {
    const result = await expenseService.updateSheet(req.params.id, req.user!, req.body);
    return sendSuccess(res, result);
  },

  async deleteSheet(req: Request, res: Response) {
    const result = await expenseService.deleteSheet(req.params.id, req.user!);
    return sendSuccess(res, result);
  },

  async submitSheet(req: Request, res: Response) {
    const result = await expenseService.submitSheet(req.params.id, req.user!);
    return sendSuccess(res, result);
  },

  async reviewSheet(req: Request, res: Response) {
    const result = await expenseService.reviewSheet(req.params.id, req.user!, req.body);
    return sendSuccess(res, result);
  },

  async addEntry(req: Request, res: Response) {
    const result = await expenseService.addEntry(req.params.sheetId, req.user!, req.body);
    return sendSuccess(res, result);
  },

  async updateEntry(req: Request, res: Response) {
    const result = await expenseService.updateEntry(req.params.entryId, req.user!, req.body);
    return sendSuccess(res, result);
  },

  async deleteEntry(req: Request, res: Response) {
    const result = await expenseService.deleteEntry(req.params.entryId, req.user!);
    return sendSuccess(res, result);
  },

  async listVouchers(req: Request, res: Response) {
    const result = await expenseService.listVouchers(
      req.user!,
      {
        employeeId: req.query.employeeId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        dateFrom: parseDateQuery(req.query.dateFrom as string | undefined),
        dateTo: parseDateQuery(req.query.dateTo as string | undefined)
      },
      req.query.page ? Number(req.query.page) : undefined,
      req.query.limit ? Number(req.query.limit) : undefined
    );
    return sendSuccess(res, result);
  }
};
