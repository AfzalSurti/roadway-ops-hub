import { prisma } from "../prisma/client.js";

type FinancialBillStatus = "PLANNING" | "PUT_UP" | "RECEIVED";

const db = prisma as any;

export const financialRepository = {
  findEligibleProjects() {
    return db.project.findMany({
      where: {
        projectNumber: { not: null },
        requisitionForm: { isNot: null }
      },
      include: {
        requisitionForm: true
      },
      orderBy: { name: "asc" }
    });
  },

  findEligibleProjectById(projectId: string) {
    return db.project.findFirst({
      where: {
        id: projectId,
        projectNumber: { not: null },
        requisitionForm: { isNot: null }
      },
      include: {
        requisitionForm: true
      }
    });
  },

  findPlanByProjectId(projectId: string) {
    return db.projectFinancialPlan.findUnique({
      where: { projectId },
      include: {
        project: true,
        items: {
          orderBy: { itemNumber: "asc" }
        },
        bills: {
          include: {
            item: true
          },
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });
  },

  findBillById(billId: string) {
    return db.projectFinancialBill.findUnique({
      where: { id: billId },
      include: {
        item: true,
        plan: true
      }
    });
  },

  async upsertPlan(args: {
    projectId: string;
    contractValue: number;
    taxAmount: number;
    totalAmount: number;
    items: Array<{ itemNumber: number; particulars: string; percentage: number; amount: number }>;
  }) {
    return db.$transaction(async (txClient: any) => {
      const tx = txClient as any;
      const plan = await tx.projectFinancialPlan.upsert({
        where: { projectId: args.projectId },
        update: {
          contractValue: args.contractValue,
          taxAmount: args.taxAmount,
          totalAmount: args.totalAmount
        },
        create: {
          projectId: args.projectId,
          contractValue: args.contractValue,
          taxAmount: args.taxAmount,
          totalAmount: args.totalAmount
        }
      });

      for (const item of args.items) {
        await tx.projectFinancialItem.upsert({
          where: {
            planId_itemNumber: {
              planId: plan.id,
              itemNumber: item.itemNumber
            }
          },
          update: {
            particulars: item.particulars,
            percentage: item.percentage,
            amount: item.amount
          },
          create: {
            planId: plan.id,
            itemNumber: item.itemNumber,
            particulars: item.particulars,
            percentage: item.percentage,
            amount: item.amount
          }
        });
      }

      const items = await tx.projectFinancialItem.findMany({
        where: { planId: plan.id }
      });

      const itemAmountMap = new Map<string, number>(items.map((item: { id: string; amount: number }) => [item.id, item.amount]));
      const bills = await tx.projectFinancialBill.findMany({ where: { planId: plan.id } });

      for (const bill of bills as Array<{ id: string; itemId: string; receivedAmount: number }>) {
        const itemAmount = itemAmountMap.get(bill.itemId) ?? 0;
        const receivedPercentage = itemAmount > 0 ? Number(((bill.receivedAmount / itemAmount) * 100).toFixed(2)) : 0;
        await tx.projectFinancialBill.update({
          where: { id: bill.id },
          data: { receivedPercentage }
        });
      }

      return tx.projectFinancialPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: {
          project: true,
          items: { orderBy: { itemNumber: "asc" } },
          bills: { include: { item: true }, orderBy: [{ createdAt: "desc" }] }
        }
      });
    });
  },

  createBills(planId: string, bills: Array<{ itemId: string; status: FinancialBillStatus; remark?: string | null }>) {
    return db.$transaction(async (txClient: any) => {
      const tx = txClient as any;
      for (const bill of bills) {
        await tx.projectFinancialBill.create({
          data: {
            planId,
            itemId: bill.itemId,
            status: bill.status,
            remark: bill.remark ?? null
          }
        });
      }

      return tx.projectFinancialPlan.findUniqueOrThrow({
        where: { id: planId },
        include: {
          project: true,
          items: { orderBy: { itemNumber: "asc" } },
          bills: { include: { item: true }, orderBy: [{ createdAt: "desc" }] }
        }
      });
    });
  },

  async updateBill(args: {
    billId: string;
    status?: FinancialBillStatus;
    receivedAmount?: number;
    receivedDate?: Date | null;
    remark?: string | null;
  }) {
    return db.$transaction(async (txClient: any) => {
      const tx = txClient as any;
      const existing = await tx.projectFinancialBill.findUniqueOrThrow({
        where: { id: args.billId },
        include: { item: true }
      });

      const nextAmount = args.receivedAmount ?? existing.receivedAmount;
      const receivedPercentage = existing.item.amount > 0 ? Number(((nextAmount / existing.item.amount) * 100).toFixed(2)) : 0;

      return tx.projectFinancialBill.update({
        where: { id: args.billId },
        data: {
          status: args.status,
          receivedAmount: args.receivedAmount,
          receivedDate: args.receivedDate,
          remark: args.remark,
          receivedPercentage
        },
        include: {
          item: true
        }
      });
    });
  }
};
