import type { ExpenseSheetStatus, Role } from "@prisma/client";
import {
  expenseRepository,
  type ExpenseSheetDetail,
  type ExpenseSheetFilters,
  type ExpenseSheetListItem
} from "../repositories/expense.repository.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";

type AuthUser = { id: string; role: Role };

function mapSheet(sheet: ExpenseSheetDetail | ExpenseSheetListItem) {
  const totalAmount = sheet.entries.reduce((sum, entry) => sum + entry.amount, 0);
  const latestApproval = sheet.approvals[0] ?? null;

  return {
    ...sheet,
    totalAmount,
    employeeName: sheet.employee.name,
    employeeEmail: sheet.employee.email,
    employeeId: sheet.employee.id,
    projectName: sheet.project?.name ?? null,
    projectNumber: sheet.project?.projectNumber ?? null,
    latestApproval
  };
}

async function generateVoucherNumber() {
  const year = new Date().getFullYear();
  const count = await expenseRepository.countVouchersForYear(year);
  return `VCH-${year}-${String(count + 1).padStart(4, "0")}`;
}

async function syncVoucherForEntry(entryId: string, billAvailable: boolean) {
  if (!billAvailable) {
    const existing = await expenseRepository.findEntryById(entryId);
    if (existing?.voucher) return existing.voucher;
    const voucherNumber = await generateVoucherNumber();
    return expenseRepository.createVoucher({
      voucherNumber,
      entry: { connect: { id: entryId } }
    });
  }
  await expenseRepository.deleteVoucherByEntryId(entryId);
  return null;
}

function assertCanViewSheet(sheet: { employeeId: string }, user: AuthUser) {
  if (user.role === "ADMIN") return;
  if (sheet.employeeId !== user.id) {
    throw forbidden("You can only access your own expense sheets");
  }
}

function assertSheetOwner(sheet: { employeeId: string }, user: AuthUser) {
  if (sheet.employeeId !== user.id) {
    throw forbidden("You can only manage your own expense sheets");
  }
}

function assertEditable(status: ExpenseSheetStatus) {
  if (status !== "DRAFT" && status !== "REJECTED") {
    throw badRequest("Only draft or rejected expense sheets can be edited");
  }
}

export const expenseService = {
  async listCategories() {
    let categories = await expenseRepository.findCategories();
    if (categories.length === 0) {
      await expenseRepository.seedDefaultCategories();
      categories = await expenseRepository.findCategories();
    }
    return categories;
  },

  async getDashboard(user: AuthUser) {
    const employeeId = user.role === "EMPLOYEE" ? user.id : undefined;
    return expenseRepository.getDashboardStats({ employeeId });
  },

  async listSheets(user: AuthUser, filters: ExpenseSheetFilters, page?: number, limit?: number) {
    const scoped = { ...filters };
    if (user.role === "EMPLOYEE") {
      scoped.employeeId = user.id;
    }
    const result = await expenseRepository.findSheets(scoped, page ?? 1, limit ?? 20);
    return {
      ...result,
      items: result.items.map((sheet) => mapSheet(sheet))
    };
  },

  async getSheetById(id: string, user: AuthUser) {
    const sheet = await expenseRepository.findSheetById(id);
    if (!sheet) throw notFound("Expense sheet not found");
    assertCanViewSheet(sheet, user);
    return mapSheet(sheet);
  },

  async createSheet(user: AuthUser, payload: {
    projectId?: string | null;
    siteName: string;
    siteIncharge: string;
    totalPersons: number;
    expenseDate: Date;
    mobileNumber?: string | null;
    bankAccount?: string | null;
    sheetNumber?: number | null;
  }) {
    if (user.role !== "EMPLOYEE" && user.role !== "ADMIN") {
      throw forbidden("Only employees and admins can create expense sheets");
    }

    const employeeId = user.id;
    const sheet = await expenseRepository.createSheet({
      employee: { connect: { id: employeeId } },
      ...(payload.projectId ? { project: { connect: { id: payload.projectId } } } : {}),
      siteName: payload.siteName,
      siteIncharge: payload.siteIncharge,
      totalPersons: payload.totalPersons,
      expenseDate: payload.expenseDate,
      mobileNumber: payload.mobileNumber ?? null,
      bankAccount: payload.bankAccount ?? null,
      sheetNumber: payload.sheetNumber ?? null,
      status: "DRAFT"
    });

    return mapSheet(sheet);
  },

  async updateSheet(id: string, user: AuthUser, payload: Partial<{
    projectId: string | null;
    siteName: string;
    siteIncharge: string;
    totalPersons: number;
    expenseDate: Date;
    mobileNumber: string | null;
    bankAccount: string | null;
    sheetNumber: number | null;
  }>) {
    const sheet = await expenseRepository.findSheetById(id);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    assertEditable(sheet.status);

    const updated = await expenseRepository.updateSheet(id, {
      ...(payload.projectId !== undefined
        ? payload.projectId
          ? { project: { connect: { id: payload.projectId } } }
          : { project: { disconnect: true } }
        : {}),
      ...(payload.siteName !== undefined ? { siteName: payload.siteName } : {}),
      ...(payload.siteIncharge !== undefined ? { siteIncharge: payload.siteIncharge } : {}),
      ...(payload.totalPersons !== undefined ? { totalPersons: payload.totalPersons } : {}),
      ...(payload.expenseDate !== undefined ? { expenseDate: payload.expenseDate } : {}),
      ...(payload.mobileNumber !== undefined ? { mobileNumber: payload.mobileNumber } : {}),
      ...(payload.bankAccount !== undefined ? { bankAccount: payload.bankAccount } : {}),
      ...(payload.sheetNumber !== undefined ? { sheetNumber: payload.sheetNumber } : {})
    });

    return mapSheet(updated);
  },

  async deleteSheet(id: string, user: AuthUser) {
    const sheet = await expenseRepository.findSheetById(id);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    assertEditable(sheet.status);
    await expenseRepository.deleteSheet(id);
    return { deleted: true };
  },

  async submitSheet(id: string, user: AuthUser) {
    const sheet = await expenseRepository.findSheetById(id);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    if (sheet.status !== "DRAFT" && sheet.status !== "REJECTED") {
      throw badRequest("Only draft or rejected sheets can be submitted");
    }
    if (sheet.entries.length === 0) {
      throw badRequest("Add at least one expense entry before submitting");
    }

    const updated = await expenseRepository.updateSheet(id, { status: "SUBMITTED" });
    return mapSheet(updated);
  },

  async reviewSheet(id: string, user: AuthUser, payload: { status: "APPROVED" | "REJECTED"; comments?: string | null }) {
    if (user.role !== "ADMIN") throw forbidden("Only admins can review expense sheets");
    const sheet = await expenseRepository.findSheetById(id);
    if (!sheet) throw notFound("Expense sheet not found");
    if (sheet.status !== "SUBMITTED") {
      throw badRequest("Only submitted expense sheets can be reviewed");
    }

    await expenseRepository.createApproval({
      sheet: { connect: { id } },
      reviewer: { connect: { id: user.id } },
      status: payload.status,
      comments: payload.comments ?? null
    });

    const updated = await expenseRepository.updateSheet(id, { status: payload.status });
    return mapSheet(updated);
  },

  async addEntry(sheetId: string, user: AuthUser, payload: {
    categoryId: string;
    entryDate: Date;
    amount: number;
    description: string;
    billAvailable: boolean;
    billNumber?: string | null;
    billAttachmentUrl?: string | null;
  }) {
    const sheet = await expenseRepository.findSheetById(sheetId);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    assertEditable(sheet.status);

    const category = await expenseRepository.findCategoryById(payload.categoryId);
    if (!category) throw badRequest("Invalid expense category");

    if (payload.billAvailable && !payload.billAttachmentUrl) {
      throw badRequest("Bill attachment is required when bill is available");
    }

    const entry = await expenseRepository.createEntry({
      sheet: { connect: { id: sheetId } },
      category: { connect: { id: payload.categoryId } },
      entryDate: payload.entryDate,
      amount: payload.amount,
      description: payload.description,
      billAvailable: payload.billAvailable,
      billNumber: payload.billNumber ?? null,
      billAttachmentUrl: payload.billAvailable ? payload.billAttachmentUrl ?? null : null
    });

    if (!payload.billAvailable) {
      await syncVoucherForEntry(entry.id, false);
    }

    return expenseRepository.findSheetById(sheetId).then((s) => mapSheet(s!));
  },

  async updateEntry(entryId: string, user: AuthUser, payload: Partial<{
    categoryId: string;
    entryDate: Date;
    amount: number;
    description: string;
    billAvailable: boolean;
    billNumber: string | null;
    billAttachmentUrl: string | null;
  }>) {
    const entry = await expenseRepository.findEntryById(entryId);
    if (!entry) throw notFound("Expense entry not found");
    const sheet = await expenseRepository.findSheetById(entry.expenseSheetId);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    assertEditable(sheet.status);

    const billAvailable = payload.billAvailable ?? entry.billAvailable;
    if (billAvailable && !(payload.billAttachmentUrl ?? entry.billAttachmentUrl)) {
      throw badRequest("Bill attachment is required when bill is available");
    }

    await expenseRepository.updateEntry(entryId, {
      ...(payload.categoryId ? { category: { connect: { id: payload.categoryId } } } : {}),
      ...(payload.entryDate !== undefined ? { entryDate: payload.entryDate } : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.billAvailable !== undefined ? { billAvailable: payload.billAvailable } : {}),
      ...(payload.billNumber !== undefined ? { billNumber: payload.billNumber } : {}),
      billAttachmentUrl: billAvailable ? payload.billAttachmentUrl ?? entry.billAttachmentUrl : null,
      ...(payload.billNumber !== undefined ? {} : {})
    });

    await syncVoucherForEntry(entryId, billAvailable);
    const refreshed = await expenseRepository.findSheetById(entry.expenseSheetId);
    return mapSheet(refreshed!);
  },

  async deleteEntry(entryId: string, user: AuthUser) {
    const entry = await expenseRepository.findEntryById(entryId);
    if (!entry) throw notFound("Expense entry not found");
    const sheet = await expenseRepository.findSheetById(entry.expenseSheetId);
    if (!sheet) throw notFound("Expense sheet not found");
    assertSheetOwner(sheet, user);
    assertEditable(sheet.status);

    await expenseRepository.deleteVoucherByEntryId(entryId);
    await expenseRepository.deleteEntry(entryId);
    const refreshed = await expenseRepository.findSheetById(entry.expenseSheetId);
    return mapSheet(refreshed!);
  },

  async listVouchers(user: AuthUser, filters: ExpenseSheetFilters, page?: number, limit?: number) {
    const scoped: ExpenseSheetFilters = { ...filters };
    if (user.role === "EMPLOYEE") scoped.employeeId = user.id;

    const result = await expenseRepository.findVouchers(
      {
        employeeId: scoped.employeeId,
        projectId: scoped.projectId,
        dateFrom: scoped.dateFrom,
        dateTo: scoped.dateTo
      },
      page ?? 1,
      limit ?? 50
    );

    return {
      ...result,
      items: result.items.map((voucher) => ({
        id: voucher.id,
        voucherNumber: voucher.voucherNumber,
        generatedAt: voucher.generatedAt,
        date: voucher.entry.entryDate,
        employeeName: voucher.entry.sheet.employee.name,
        projectName: voucher.entry.sheet.project?.name ?? voucher.entry.sheet.siteName,
        projectNumber: voucher.entry.sheet.project?.projectNumber ?? null,
        expenseCategory: voucher.entry.category.name,
        description: voucher.entry.description,
        amount: voucher.entry.amount,
        approvalStatus: voucher.entry.sheet.status
      }))
    };
  }
};
