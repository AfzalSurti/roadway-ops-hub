import { prisma } from "../prisma/client.js";

type FinancialBillStatus = "PLANNING" | "PUT_UP" | "RECEIVED";

const db = prisma as any;

const RA_BILL_LINK_SELECT = {
  id: true,
  billName: true,
  status: true,
  planningType: true,
  totalAmount: true,
  totalReceivedAmount: true,
  receivedDate: true
} as const;

const RA_BILL_INCLUDE = {
  items: {
    include: { item: true },
    orderBy: { createdAt: "asc" }
  },
  outgoingCarryForwards: {
    include: {
      targetRaBill: {
        select: RA_BILL_LINK_SELECT
      }
    },
    orderBy: { createdAt: "asc" }
  },
  incomingCarryForwards: {
    include: {
      sourceRaBill: {
        select: RA_BILL_LINK_SELECT
      }
    },
    orderBy: { createdAt: "asc" }
  }
} as const;

const PLAN_INCLUDE = {
  project: true,
  items: { orderBy: { itemNumber: "asc" } },
  raBills: {
    include: RA_BILL_INCLUDE,
    orderBy: { billName: "asc" }
  }
} as const;

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
      include: PLAN_INCLUDE
    });
  },

  findBillById(billId: string) {
    return db.projectFinancialBill.findUnique({
      where: { id: billId },
      include: {
        item: true,
        plan: { include: { project: true } },
        raBill: true
      }
    });
  },

  findRaBillById(raBillId: string) {
    return db.projectFinancialRaBill.findUnique({
      where: { id: raBillId },
      include: {
        ...RA_BILL_INCLUDE,
        plan: { include: { project: { include: { requisitionForm: true } } } }
      }
    });
  },

  async upsertPlan(args: {
    projectId: string;
    contractValue: number;
    taxAmount: number;
    totalAmount: number;
    items: Array<{ itemNumber: number; particulars: string; percentage: number; amount: number; planningType: "NORMAL" | "EXCESS" }>;
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
            planId_itemNumber_planningType: {
              planId: plan.id,
              itemNumber: item.itemNumber,
              planningType: item.planningType
            }
          },
          update: {
            particulars: item.particulars,
            percentage: item.percentage,
            amount: item.amount,
            planningType: item.planningType
          },
          create: {
            planId: plan.id,
            itemNumber: item.itemNumber,
            planningType: item.planningType,
            particulars: item.particulars,
            percentage: item.percentage,
            amount: item.amount
          }
        });
      }

      const currentPlanningType = args.items[0]?.planningType ?? "NORMAL";

      await tx.projectFinancialItem.deleteMany({
        where: {
          planId: plan.id,
          planningType: currentPlanningType,
          itemNumber: {
            notIn: args.items.map((item) => item.itemNumber)
          }
        }
      });

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
        include: PLAN_INCLUDE
      });
    });
  },

  async createRaBill(args: {
    planId: string;
    billName: string;
    planningType: "NORMAL" | "EXCESS";
    billItems: Array<{
      itemId: string;
      billPercentage: number;
      billAmount: number;
      taxAmount: number;
      totalAmount: number;
      carryForwardAmount: number;
    }>;
    carryForwards: Array<{
      sourceRaBillId: string;
      amount: number;
    }>;
    totalBillAmount: number;
    totalTaxAmount: number;
    totalAmount: number;
  }) {
    return db.$transaction(async (txClient: any) => {
      const tx = txClient as any;

      const raBill = await tx.projectFinancialRaBill.create({
        data: {
          planId: args.planId,
          billName: args.billName,
          planningType: args.planningType,
          status: "PLANNING",
          totalBillAmount: args.totalBillAmount,
          totalTaxAmount: args.totalTaxAmount,
          totalAmount: args.totalAmount
        }
      });

      for (const item of args.billItems) {
        await tx.projectFinancialBill.create({
          data: {
            planId: args.planId,
            raBillId: raBill.id,
            itemId: item.itemId,
            billPercentage: item.billPercentage,
            billAmount: item.billAmount,
            taxAmount: item.taxAmount,
            totalAmount: item.totalAmount,
            carryForwardAmount: item.carryForwardAmount,
            status: "PLANNING"
          }
        });
      }

      for (const carryForward of args.carryForwards) {
        await tx.projectFinancialCarryForward.create({
          data: {
            sourceRaBillId: carryForward.sourceRaBillId,
            targetRaBillId: raBill.id,
            amount: carryForward.amount
          }
        });
      }

      return tx.projectFinancialPlan.findUniqueOrThrow({
        where: { id: args.planId },
        include: PLAN_INCLUDE
      });
    });
  },

  async updateRaBill(args: {
    raBillId: string;
    status?: FinancialBillStatus;
    receivedDate?: Date | null;
    chequeRtgsAmount?: number;
    itDeductionPct?: number;
    itDeductionAmount?: number;
    lCessDeductionPct?: number;
    lCessDeductionAmount?: number;
    securityDepositPct?: number;
    securityDepositAmount?: number;
    recoverFromRaBillPct?: number;
    recoverFromRaBillAmount?: number;
    gstWithheldPct?: number;
    gstWithheldAmount?: number;
    withheldPct?: number;
    withheldAmount?: number;
    totalReceivedAmount?: number;
    remark?: string | null;
  }) {
    return db.projectFinancialRaBill.update({
      where: { id: args.raBillId },
      data: {
        status: args.status,
        receivedDate: args.receivedDate,
        chequeRtgsAmount: args.chequeRtgsAmount,
        itDeductionPct: args.itDeductionPct,
        itDeductionAmount: args.itDeductionAmount,
        lCessDeductionPct: args.lCessDeductionPct,
        lCessDeductionAmount: args.lCessDeductionAmount,
        securityDepositPct: args.securityDepositPct,
        securityDepositAmount: args.securityDepositAmount,
        recoverFromRaBillPct: args.recoverFromRaBillPct,
        recoverFromRaBillAmount: args.recoverFromRaBillAmount,
        gstWithheldPct: args.gstWithheldPct,
        gstWithheldAmount: args.gstWithheldAmount,
        withheldPct: args.withheldPct,
        withheldAmount: args.withheldAmount,
        totalReceivedAmount: args.totalReceivedAmount,
        remark: args.remark
      },
      include: {
        ...RA_BILL_INCLUDE,
        plan: { include: { project: { include: { requisitionForm: true } } } }
      }
    });
  },

  // Legacy kept for backward compat
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
      const receivedPercentage = existing.billAmount > 0 ? Number(((nextAmount / existing.billAmount) * 100).toFixed(2)) : 0;

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
