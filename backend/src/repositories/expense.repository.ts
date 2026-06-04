import type { ExpenseSheetStatus, Prisma } from "@prisma/client";
import { DEFAULT_EXPENSE_CATEGORIES } from "../data/expense-categories.js";
import { prisma } from "../prisma/client.js";

function aggregateMonthlyTrend(entries: Array<{ entryDate: Date; amount: number }>) {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const month = entry.entryDate.toISOString().slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + entry.amount);
  }
  return [...map.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);
}

const sheetInclude = {
  employee: { select: { id: true, name: true, email: true, contactNumber: true } },
  project: { select: { id: true, name: true, projectNumber: true } },
  entries: {
    include: {
      category: true,
      voucher: true
    },
    orderBy: { entryDate: "asc" as const }
  },
  approvals: {
    include: { reviewer: { select: { id: true, name: true, email: true } } },
    orderBy: { reviewedAt: "desc" as const }
  }
} satisfies Prisma.ExpenseSheetInclude;

/** Lighter shape for list screens — avoids loading every entry/voucher/approval row. */
const sheetListInclude = {
  employee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, projectNumber: true } },
  entries: { select: { amount: true } },
  approvals: {
    take: 1,
    orderBy: { reviewedAt: "desc" as const },
    include: { reviewer: { select: { id: true, name: true, email: true } } }
  }
} satisfies Prisma.ExpenseSheetInclude;

export type ExpenseSheetDetail = Prisma.ExpenseSheetGetPayload<{ include: typeof sheetInclude }>;
export type ExpenseSheetListItem = Prisma.ExpenseSheetGetPayload<{ include: typeof sheetListInclude }>;

export type ExpenseSheetFilters = {
  employeeId?: string;
  projectId?: string;
  siteName?: string;
  status?: ExpenseSheetStatus;
  categoryId?: string;
  billAvailable?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

export const expenseRepository = {
  findCategories() {
    return prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" }
    });
  },

  async seedDefaultCategories() {
    const now = new Date();
    await prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true,
        createdAt: now,
        updatedAt: now
      })),
      skipDuplicates: true
    });
  },

  findCategoryById(id: string) {
    return prisma.expenseCategory.findUnique({ where: { id } });
  },

  findSheetById(id: string) {
    return prisma.expenseSheet.findUnique({
      where: { id },
      include: sheetInclude
    });
  },

  async findSheets(filters: ExpenseSheetFilters, page = 1, limit = 20) {
    const where: Prisma.ExpenseSheetWhereInput = {};

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.siteName) where.siteName = { contains: filters.siteName, mode: "insensitive" };
    if (filters.dateFrom || filters.dateTo) {
      where.expenseDate = {};
      if (filters.dateFrom) where.expenseDate.gte = filters.dateFrom;
      if (filters.dateTo) where.expenseDate.lte = filters.dateTo;
    }
    if (filters.categoryId || filters.billAvailable !== undefined) {
      where.entries = {
        some: {
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.billAvailable !== undefined ? { billAvailable: filters.billAvailable } : {})
        }
      };
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { siteName: { contains: q, mode: "insensitive" } },
        { siteIncharge: { contains: q, mode: "insensitive" } },
        { employee: { name: { contains: q, mode: "insensitive" } } },
        { project: { name: { contains: q, mode: "insensitive" } } },
        { project: { projectNumber: { contains: q, mode: "insensitive" } } }
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.expenseSheet.findMany({
        where,
        include: sheetListInclude,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit
      }),
      prisma.expenseSheet.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  createSheet(data: Prisma.ExpenseSheetCreateInput) {
    return prisma.expenseSheet.create({ data, include: sheetInclude });
  },

  updateSheet(id: string, data: Prisma.ExpenseSheetUpdateInput) {
    return prisma.expenseSheet.update({ where: { id }, data, include: sheetInclude });
  },

  deleteSheet(id: string) {
    return prisma.expenseSheet.delete({ where: { id } });
  },

  findEntryById(id: string) {
    return prisma.expenseEntry.findUnique({
      where: { id },
      include: { sheet: true, category: true, voucher: true }
    });
  },

  createEntry(data: Prisma.ExpenseEntryCreateInput) {
    return prisma.expenseEntry.create({
      data,
      include: { category: true, voucher: true, sheet: { include: sheetInclude } }
    });
  },

  updateEntry(id: string, data: Prisma.ExpenseEntryUpdateInput) {
    return prisma.expenseEntry.update({
      where: { id },
      data,
      include: { category: true, voucher: true, sheet: true }
    });
  },

  deleteEntry(id: string) {
    return prisma.expenseEntry.delete({ where: { id } });
  },

  createVoucher(data: Prisma.VoucherCreateInput) {
    return prisma.voucher.create({ data });
  },

  deleteVoucherByEntryId(expenseEntryId: string) {
    return prisma.voucher.deleteMany({ where: { expenseEntryId } });
  },

  async countVouchersForYear(year: number) {
    const prefix = `VCH-${year}-`;
    return prisma.voucher.count({
      where: { voucherNumber: { startsWith: prefix } }
    });
  },

  createApproval(data: Prisma.ExpenseApprovalCreateInput) {
    return prisma.expenseApproval.create({
      data,
      include: { reviewer: { select: { id: true, name: true, email: true } } }
    });
  },

  async findVouchers(filters: { employeeId?: string; projectId?: string; dateFrom?: Date; dateTo?: Date }, page = 1, limit = 50) {
    const where: Prisma.VoucherWhereInput = {
      entry: {
        sheet: {
          ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                expenseDate: {
                  ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                  ...(filters.dateTo ? { lte: filters.dateTo } : {})
                }
              }
            : {})
        },
        billAvailable: false
      }
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          entry: {
            include: {
              category: true,
              sheet: {
                include: {
                  employee: { select: { id: true, name: true, email: true } },
                  project: { select: { id: true, name: true, projectNumber: true } }
                }
              }
            }
          }
        },
        orderBy: { generatedAt: "desc" },
        skip,
        take: limit
      }),
      prisma.voucher.count({ where })
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  async getDashboardStats(filters: { employeeId?: string }) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const sheetWhere: Prisma.ExpenseSheetWhereInput = filters.employeeId ? { employeeId: filters.employeeId } : {};

    const entryWhereBase: Prisma.ExpenseEntryWhereInput = {
      sheet: sheetWhere
    };

    const [
      monthAgg,
      todayAgg,
      pendingCount,
      approvedCount,
      rejectedCount,
      voucherCount,
      byCategory,
      monthlyEntries,
      byEmployee,
      recentSheets
    ] = await Promise.all([
      prisma.expenseEntry.aggregate({
        where: { ...entryWhereBase, entryDate: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.expenseEntry.aggregate({
        where: { ...entryWhereBase, entryDate: { gte: startOfDay, lte: endOfDay } },
        _sum: { amount: true }
      }),
      prisma.expenseSheet.count({ where: { ...sheetWhere, status: "SUBMITTED" } }),
      prisma.expenseSheet.count({ where: { ...sheetWhere, status: "APPROVED" } }),
      prisma.expenseSheet.count({ where: { ...sheetWhere, status: "REJECTED" } }),
      prisma.voucher.count({
        where: { entry: { sheet: sheetWhere, billAvailable: false } }
      }),
      prisma.expenseEntry.groupBy({
        by: ["categoryId"],
        where: entryWhereBase,
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } }
      }),
      prisma.expenseEntry.findMany({
        where: entryWhereBase,
        select: { entryDate: true, amount: true },
        orderBy: { entryDate: "desc" },
        take: 500
      }),
      filters.employeeId
        ? Promise.resolve([])
        : prisma.expenseEntry.groupBy({
            by: ["expenseSheetId"],
            _sum: { amount: true },
            orderBy: { _sum: { amount: "desc" } },
            take: 10
          }),
      prisma.expenseSheet.findMany({
        where: sheetWhere,
        include: {
          employee: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, projectNumber: true } },
          entries: { select: { amount: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 10
      })
    ]);

    const categories = await prisma.expenseCategory.findMany();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    let expenseByEmployee: Array<{ employeeId: string; employeeName: string; total: number }> = [];
    if (!filters.employeeId && byEmployee.length > 0) {
      const sheetIds = byEmployee.map((row) => row.expenseSheetId);
      const sheets = await prisma.expenseSheet.findMany({
        where: { id: { in: sheetIds } },
        include: { employee: { select: { id: true, name: true } } }
      });
      const sheetMap = new Map(sheets.map((s) => [s.id, s]));
      expenseByEmployee = byEmployee.map((row) => {
        const sheet = sheetMap.get(row.expenseSheetId);
        return {
          employeeId: sheet?.employeeId ?? "",
          employeeName: sheet?.employee.name ?? "Unknown",
          total: row._sum.amount ?? 0
        };
      });
    }

    return {
      totalExpensesThisMonth: monthAgg._sum.amount ?? 0,
      totalExpensesToday: todayAgg._sum.amount ?? 0,
      pendingApprovals: pendingCount,
      approvedExpenses: approvedCount,
      rejectedExpenses: rejectedCount,
      totalVoucherEntries: voucherCount,
      expenseByCategory: byCategory.map((row) => ({
        categoryId: row.categoryId,
        categoryName: categoryMap.get(row.categoryId) ?? "Unknown",
        total: row._sum.amount ?? 0
      })),
      monthlyExpenseTrend: aggregateMonthlyTrend(monthlyEntries),
      expenseByEmployee,
      recentSheets
    };
  },

  async getEmployeeCategoryAnalytics(employeeId?: string) {
    const employees = await prisma.user.findMany({
      where: {
        expenseSheets: { some: { entries: { some: {} } } }
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });

    const categoryOrder = await this.findCategories();

    if (!employeeId) {
      return {
        employees,
        selectedEmployeeId: null,
        categories: categoryOrder.map((cat) => ({
          categoryId: cat.id,
          categoryName: cat.name,
          total: 0,
          breakdown: [] as Array<{ label: string; amount: number }>
        })),
        totalAmount: 0
      };
    }

    const entries = await prisma.expenseEntry.findMany({
      where: { sheet: { employeeId } },
      select: {
        amount: true,
        entryDate: true,
        description: true,
        categoryId: true,
        category: { select: { id: true, name: true, sortOrder: true } }
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }]
    });

    const byCategory = new Map<
      string,
      { categoryId: string; categoryName: string; total: number; breakdown: Array<{ label: string; amount: number }> }
    >();

    for (const cat of categoryOrder) {
      byCategory.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        total: 0,
        breakdown: []
      });
    }

    for (const entry of entries) {
      const bucket = byCategory.get(entry.categoryId);
      if (!bucket) continue;
      bucket.total += entry.amount;
      const dateLabel = entry.entryDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      const label = `${dateLabel} — ${entry.description.slice(0, 40)}`;
      bucket.breakdown.push({ label, amount: entry.amount });
    }

    const categoryTotals = categoryOrder.map((cat) => byCategory.get(cat.id)!);
    const totalAmount = categoryTotals.reduce((sum, row) => sum + row.total, 0);

    return {
      employees,
      selectedEmployeeId: employeeId,
      categories: categoryTotals,
      totalAmount
    };
  }
};
