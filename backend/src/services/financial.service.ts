import { financialRepository } from "../repositories/financial.repository.js";
import { badRequest, notFound } from "../utils/errors.js";

type FinancialBillStatus = "PLANNING" | "PUT_UP" | "RECEIVED";

export const FINANCIAL_ITEM_TEMPLATES = [
  {
    itemNumber: 1,
    particulars: "Submission of Alignment option including Marking of ROW & Inception report. Preparation of LA Proposal, Forest Clearance proposal & CRZ Clearance"
  },
  {
    itemNumber: 2,
    particulars: "Survey / Investigation / Approval of GAD of Proposed ROB / Flyover / VUP / River Bridge from GoG and Indian Railway including its approaches & Survey, Investigation, Pavement analysis, Cross drainage condition survey, & Design of Highway"
  },
  {
    itemNumber: 3,
    particulars: "Preparation and approval of BOQ / Detailed Estimate by concern authority & Preparation and approval of Draft Tender Paper"
  },
  {
    itemNumber: 4,
    particulars: "Design and approval of drawings of all components of Bridge / ROB / RUB / VUP / Flyover / other structures"
  },
  {
    itemNumber: 5,
    particulars: "Completion of 11 months or complete submission of design, drawings etc with satisfactory work, whichever is earlier"
  },
  {
    itemNumber: 6,
    particulars: "On physical completion of civil work"
  }
] as const;

function parseMoney(value?: string | null) {
  const sanitized = String(value ?? "0").replace(/[^\d.-]/g, "");
  const parsed = Number(sanitized || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

async function getEligibleProjectOrThrow(projectId: string) {
  const project = await financialRepository.findEligibleProjectById(projectId);
  if (!project || !project.requisitionForm) {
    throw badRequest("Financial section is available only for projects with project number and requisition form");
  }
  return project;
}

export const financialService = {
  async listEligibleProjects() {
    const projects = await financialRepository.findEligibleProjects();
    return projects.map((project: { id: string; name: string; projectNumber: string; requisitionForm: { id: string; amountOfWorkOrder: string; workOrderValue: string; gstAmount: string } }) => ({
      id: project.id,
      name: project.name,
      projectNumber: project.projectNumber!,
      requisitionFormId: project.requisitionForm!.id,
      contractValue: round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue)),
      taxAmount: round2(parseMoney(project.requisitionForm!.gstAmount)),
      totalAmount: round2(
        parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue) + parseMoney(project.requisitionForm!.gstAmount)
      )
    }));
  },

  async getProjectFinancial(projectId: string) {
    const project = await getEligibleProjectOrThrow(projectId);
    const contractValue = round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue));
    const taxAmount = round2(parseMoney(project.requisitionForm!.gstAmount));
    const totalAmount = round2(contractValue + taxAmount);
    const plan = await financialRepository.findPlanByProjectId(projectId);

    return {
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber!,
        requisitionFormId: project.requisitionForm!.id,
        contractValue,
        taxAmount,
        totalAmount
      },
      itemTemplates: FINANCIAL_ITEM_TEMPLATES,
      plan
    };
  },

  async upsertPlan(projectId: string, payload: { items: Array<{ itemNumber: number; particulars: string; percentage: number }> }) {
    const project = await getEligibleProjectOrThrow(projectId);
    const contractValue = round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue));
    const taxAmount = round2(parseMoney(project.requisitionForm!.gstAmount));
    const totalAmount = round2(contractValue + taxAmount);

    const byItemNumber = [...payload.items].sort((a, b) => a.itemNumber - b.itemNumber);
    const unique = new Set(byItemNumber.map((item) => item.itemNumber));
    if (unique.size !== byItemNumber.length) {
      throw badRequest("Item numbers must be unique");
    }

    const items = byItemNumber.map((item) => ({
      itemNumber: item.itemNumber,
      particulars: item.particulars,
      percentage: round2(Number(item.percentage)),
      amount: round2((totalAmount * Number(item.percentage)) / 100)
    }));

    return financialRepository.upsertPlan({
      projectId,
      contractValue,
      taxAmount,
      totalAmount,
      items
    });
  },

  async createBills(projectId: string, payload: { bills: Array<{ itemId: string; includePreviousRemaining?: boolean; status: FinancialBillStatus; remark?: string | null }> }) {
    const plan = await financialRepository.findPlanByProjectId(projectId);
    if (!plan) {
      throw badRequest("Create financial item planning first");
    }

    const itemIds = new Set<string>(plan.items.map((item: { id: string }) => item.id));
    if (payload.bills.some((bill) => !itemIds.has(bill.itemId))) {
      throw badRequest("One or more selected items do not belong to this project plan");
    }

    const billsToCreate = payload.bills.map((entry) => {
      const item = plan.items.find((i: { id: string; amount: number }) => i.id === entry.itemId);
      if (!item) {
        throw badRequest("Invalid financial item selected");
      }

      const itemBills = plan.bills
        .filter((bill: { itemId: string; createdAt: string; receivedAmount: number; billAmount?: number }) => bill.itemId === entry.itemId)
        .sort((a: { createdAt: string }, b: { createdAt: string }) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const totalReceived = itemBills.reduce((sum: number, bill: { receivedAmount: number }) => sum + Number(bill.receivedAmount ?? 0), 0);
      const baseAvailable = Math.max(0, round2(item.amount - totalReceived));
      const latestBill = itemBills[0];
      const latestRemaining = latestBill ? Math.max(0, round2((latestBill.billAmount ?? item.amount) - Number(latestBill.receivedAmount ?? 0))) : 0;

      const includePreviousRemaining = Boolean(entry.includePreviousRemaining);
      const carryForwardAmount = includePreviousRemaining ? latestRemaining : 0;
      const billAmount = includePreviousRemaining && latestRemaining > 0 ? latestRemaining : baseAvailable;

      return {
        itemId: entry.itemId,
        status: entry.status,
        remark: entry.remark ?? null,
        billAmount,
        carryForwardAmount
      };
    });

    return financialRepository.createBills(plan.id, billsToCreate);
  },

  async updateBill(billId: string, payload: { status?: FinancialBillStatus; receivedAmount?: number; receivedDate?: Date | null; remark?: string | null }) {
    const existing = await financialRepository.findBillById(billId);
    if (!existing) {
      throw notFound("Financial bill not found");
    }

    if (payload.receivedAmount !== undefined) {
      if (payload.receivedAmount > existing.billAmount + 0.01) {
        throw badRequest("Received amount cannot exceed this bill amount");
      }

      const totalReceivedOtherBills = existing.planId
        ? (await financialRepository.findPlanByProjectId(existing.plan.projectId))?.bills
            .filter((bill: { itemId: string; id: string }) => bill.itemId === existing.itemId && bill.id !== billId)
            .reduce((sum: number, bill: { receivedAmount: number }) => sum + bill.receivedAmount, 0) ?? 0
        : 0;
      if (payload.receivedAmount + totalReceivedOtherBills > existing.item.amount + 0.01) {
        throw badRequest("Received amount exceeds planned amount for this item");
      }
    }

    return financialRepository.updateBill(payload.receivedDate === undefined && payload.status === "RECEIVED" && payload.receivedAmount !== undefined
      ? { ...payload, billId, receivedDate: existing.receivedDate ?? new Date() }
      : { ...payload, billId });
  }
};
