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

type CarryForwardRaBill = {
  totalAmount: number;
  totalReceivedAmount: number;
  outgoingCarryForwards?: Array<{ amount: number }>;
};

function getRemainingAmount(raBill: CarryForwardRaBill) {
  return round2(Math.max(Number(raBill.totalAmount ?? 0) - Number(raBill.totalReceivedAmount ?? 0), 0));
}

function getAllocatedCarryForwardAmount(raBill: CarryForwardRaBill) {
  return round2((raBill.outgoingCarryForwards ?? []).reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0));
}

function getAvailableCarryForwardAmount(raBill: CarryForwardRaBill) {
  return round2(Math.max(getRemainingAmount(raBill) - getAllocatedCarryForwardAmount(raBill), 0));
}

async function getEligibleProjectOrThrow(projectId: string) {
  const project = await financialRepository.findEligibleProjectById(projectId);
  if (!project || !project.requisitionForm) {
    throw badRequest("Financial section is available only for projects with project number and requisition form");
  }
  return project;
}

export const financialService = {
  async getAllProjectsBillStatus() {
    const projects = await financialRepository.findAllEligibleProjectsWithFinancial();

    const rows = projects.map((project: {
      id: string;
      name: string;
      projectNumber: string;
      requisitionForm: {
        nameOfWork?: string | null;
        amountOfWorkOrder?: string | null;
        workOrderValue?: string | null;
      } | null;
      financialPlan?: {
        items?: Array<{ amount: number; planningType?: "NORMAL" | "EXCESS" }>;
        raBills?: Array<{
          status: FinancialBillStatus;
          planningType?: "NORMAL" | "EXCESS";
          totalBillAmount: number;
          chequeRtgsAmount: number;
          remark?: string | null;
          createdAt?: Date;
        }>;
      } | null;
    }) => {
      const requisition = project.requisitionForm;
      const plan = project.financialPlan;
      const allBills = plan?.raBills ?? [];
      const normalBills = allBills.filter((bill) => (bill.planningType ?? "NORMAL") === "NORMAL");
      const excessBills = allBills.filter((bill) => (bill.planningType ?? "NORMAL") === "EXCESS");

      const workOrderAmountExclGst = round2(parseMoney(requisition?.amountOfWorkOrder || requisition?.workOrderValue));
      const receivedAmountExclGst = round2(
        normalBills
          .filter((bill) => bill.status === "RECEIVED")
          .reduce((sum, bill) => sum + Number(bill.chequeRtgsAmount || 0), 0)
      );
      const financialProgressPct = workOrderAmountExclGst > 0 ? round2((receivedAmountExclGst / workOrderAmountExclGst) * 100) : 0;
      const raBillRaisedClaim = round2(normalBills.reduce((sum, bill) => sum + Number(bill.totalBillAmount || 0), 0));
      const planningAmount = round2(Math.max(workOrderAmountExclGst - raBillRaisedClaim, 0));

      const excessItems = (plan?.items ?? []).filter((item) => (item.planningType ?? "NORMAL") === "EXCESS");
      const totalExcessExclGst = round2(excessItems.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      const excessReceived = round2(
        excessBills
          .filter((bill) => bill.status === "RECEIVED")
          .reduce((sum, bill) => sum + Number(bill.chequeRtgsAmount || 0), 0)
      );
      const excessBillRaisedClaim = round2(excessBills.reduce((sum, bill) => sum + Number(bill.totalBillAmount || 0), 0));

      const latestRemark = [...allBills]
        .reverse()
        .find((bill) => (bill.remark ?? "").trim().length > 0)?.remark ?? "";

      return {
        projectId: project.id,
        folderNo: "",
        dprProject: (requisition?.nameOfWork ?? project.name ?? "").trim(),
        projectNo: project.projectNumber,
        workOrderAmountExclGst,
        receivedAmountExclGst,
        financialProgressPct,
        raBillRaisedClaim,
        planningAmount,
        totalExcessExclGst,
        excessReceived,
        excessBillRaisedClaim,
        remark: latestRemark
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      rows,
      missingColumns: [
        "folderNo"
      ]
    };
  },

  async listEligibleProjects() {
    const projects = await financialRepository.findEligibleProjects();
    return projects.map((project: { id: string; name: string; projectNumber: string; requisitionForm: { id: string; amountOfWorkOrder: string; workOrderValue: string; gstAmount: string } }) => ({
      contractValue: round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue)),
      taxAmount: round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue) * 0.18),
      totalAmount: round2(
        parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue) +
          parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue) * 0.18
      ),
      id: project.id,
      name: project.name,
      projectNumber: project.projectNumber!,
      requisitionFormId: project.requisitionForm!.id
    }));
  },

  async getProjectFinancial(projectId: string) {
    const project = await getEligibleProjectOrThrow(projectId);
    const contractValue = round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue));
    const taxAmount = round2(contractValue * 0.18);
    const totalAmount = round2(contractValue + taxAmount);
    const plan = await financialRepository.findPlanByProjectId(projectId);

    return {
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.projectNumber!,
        requisitionFormId: project.requisitionForm!.id,
        workOrderNumber: project.requisitionForm!.workOrderNumber,
        workOrderDate: project.requisitionForm!.workOrderDate,
        billingName: project.requisitionForm!.billingName,
        designation: project.requisitionForm!.designation,
        department: project.requisitionForm!.department,
        addressWithPincode: project.requisitionForm!.addressWithPincode,
        nameOfWork: project.requisitionForm!.nameOfWork,
        panTanNumber: project.requisitionForm!.panTanNumber,
        gstNumber: project.requisitionForm!.gstNumber,
        contractValue,
        taxAmount,
        totalAmount
      },
      itemTemplates: FINANCIAL_ITEM_TEMPLATES,
      plan
    };
  },

  async upsertPlan(projectId: string, payload: { planningType?: "NORMAL" | "EXCESS"; items: Array<{ itemNumber: number; particulars: string; percentage: number }> }) {
    const project = await getEligibleProjectOrThrow(projectId);
    const contractValue = round2(parseMoney(project.requisitionForm!.amountOfWorkOrder || project.requisitionForm!.workOrderValue));
    const taxAmount = round2(contractValue * 0.18);
    const totalAmount = round2(contractValue + taxAmount);

    const planningType = payload.planningType ?? "NORMAL";

    const byItemNumber = [...payload.items].sort((a, b) => a.itemNumber - b.itemNumber);
    const unique = new Set(byItemNumber.map((item) => item.itemNumber));
    if (unique.size !== byItemNumber.length) {
      throw badRequest("Item numbers must be unique");
    }

    const items = byItemNumber.map((item) => ({
      itemNumber: item.itemNumber,
      particulars: item.particulars,
      percentage: round2(Number(item.percentage)),
      amount: round2((contractValue * Number(item.percentage)) / 100),
      planningType
    }));

    return financialRepository.upsertPlan({
      projectId,
      contractValue,
      taxAmount,
      totalAmount,
      items
    });
  },

  async createRaBill(projectId: string, payload: {
    planningType?: "NORMAL" | "EXCESS";
    items: Array<{ itemId: string; billPercentage: number }>;
    carryForwards?: Array<{ sourceRaBillId: string; amount: number }>;
  }) {
    const plan = await financialRepository.findPlanByProjectId(projectId);
    if (!plan) {
      throw badRequest("Create financial item planning first");
    }

    const planningType = payload.planningType ?? "NORMAL";
    const requestedCarryForwards = payload.carryForwards ?? [];

    const itemIds = new Set<string>(plan.items.map((item: { id: string }) => item.id));
    if (payload.items.some((entry) => !itemIds.has(entry.itemId))) {
      throw badRequest("One or more selected items do not belong to this project plan");
    }

    if (payload.items.length === 0) {
      throw badRequest("Select at least one item for the RA bill");
    }

    const prefix = planningType === "EXCESS" ? "XS" : "RA";
    const existingNames = (plan.raBills ?? [])
      .filter((b: { planningType?: "NORMAL" | "EXCESS" }) => (b.planningType ?? "NORMAL") === planningType)
      .map((b: { billName: string }) => b.billName);
    const existingNumbers = existingNames
      .map((n: string) => {
        const match = new RegExp(`^${prefix}-(\\d+)$`).exec(n);
        return match ? Number(match[1]) : 0;
      })
      .filter((n: number) => n > 0);
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const billName = `${prefix}-${nextNumber}`;

    const planItemsById = new Map<string, { id: string; itemNumber: number; amount: number; percentage: number }>(
      plan.items
        .filter((item: { planningType?: "NORMAL" | "EXCESS" }) => (item.planningType ?? "NORMAL") === planningType)
        .map((item: { id: string; itemNumber: number; amount: number; percentage: number }) => [item.id, item] as const)
    );

    const previouslyUsedByItemId = new Map<string, number>();
    for (const raBill of (plan.raBills ?? []).filter((bill: { planningType?: "NORMAL" | "EXCESS" }) => (bill.planningType ?? "NORMAL") === planningType)) {
      for (const billItem of raBill.items ?? []) {
        previouslyUsedByItemId.set(
          billItem.itemId,
          round2((previouslyUsedByItemId.get(billItem.itemId) ?? 0) + Number(billItem.billPercentage ?? 0))
        );
      }
    }

    const requestedByItemId = new Map<string, number>();
    for (const entry of payload.items) {
      requestedByItemId.set(entry.itemId, round2((requestedByItemId.get(entry.itemId) ?? 0) + Number(entry.billPercentage ?? 0)));
    }

    for (const [itemId, requestedPercentage] of requestedByItemId.entries()) {
      const planItem = planItemsById.get(itemId);
      if (!planItem) {
        throw badRequest("Invalid financial item selected for this planning type");
      }
      const previouslyUsed = previouslyUsedByItemId.get(itemId) ?? 0;
      const remainingPercentage = round2(Math.max(planItem.percentage - previouslyUsed, 0));
      if (planningType === "EXCESS") {
        const requestedAmount = planItem.percentage > 0
          ? round2((planItem.amount * requestedPercentage) / planItem.percentage)
          : 0;
        const previouslyUsedAmount = planItem.percentage > 0
          ? round2((planItem.amount * previouslyUsed) / planItem.percentage)
          : 0;
        const remainingAmount = round2(Math.max(planItem.amount - previouslyUsedAmount, 0));
        if (requestedAmount > remainingAmount + 0.0001) {
          throw badRequest(
            `Item ${planItem.itemNumber} has only ${remainingAmount.toFixed(2)} amount remaining. Previously billed ${previouslyUsedAmount.toFixed(2)} out of ${planItem.amount.toFixed(2)}.`
          );
        }
      }
      if (requestedPercentage > remainingPercentage + 0.0001) {
        throw badRequest(
          `Item ${planItem.itemNumber} has only ${remainingPercentage.toFixed(2)}% remaining. Previously billed ${previouslyUsed.toFixed(2)}% out of ${planItem.percentage.toFixed(2)}%.`
        );
      }
    }

    const sourceBillsById = new Map(
      (plan.raBills ?? [])
        .filter((bill: { id: string; status: FinancialBillStatus; planningType?: "NORMAL" | "EXCESS" }) => bill.status === "RECEIVED" && (bill.planningType ?? "NORMAL") === planningType)
        .map((bill: { id: string }) => [bill.id, bill] as const)
    );

    const carryForwardsBySourceId = new Map<string, number>();
    for (const entry of requestedCarryForwards) {
      carryForwardsBySourceId.set(
        entry.sourceRaBillId,
        round2((carryForwardsBySourceId.get(entry.sourceRaBillId) ?? 0) + Number(entry.amount ?? 0))
      );
    }

    for (const [sourceRaBillId, requestedAmount] of carryForwardsBySourceId.entries()) {
      const sourceBill = sourceBillsById.get(sourceRaBillId) as CarryForwardRaBill & { billName?: string } | undefined;
      if (!sourceBill) {
        throw badRequest("Carry forward can be taken only from received bills of the same bill type");
      }
      const availableCarryForward = getAvailableCarryForwardAmount(sourceBill);
      if (requestedAmount > availableCarryForward + 0.0001) {
        throw badRequest(
          `${sourceBill.billName ?? "Selected bill"} has only ${availableCarryForward.toFixed(2)} remaining available for carry forward.`
        );
      }
    }

    const billItems = payload.items.map((entry) => {
      const planItem = planItemsById.get(entry.itemId);
      if (!planItem) {
        throw badRequest("Invalid financial item selected for this planning type");
      }
      const billPercentage = round2(Number(entry.billPercentage));
      const fraction = planItem.percentage > 0 ? billPercentage / planItem.percentage : 0;
      const billAmount = round2(planItem.amount * fraction);
      const taxAmount = round2(billAmount * 0.18);
      const totalAmount = round2(billAmount + taxAmount);
      return {
        itemId: entry.itemId,
        billPercentage,
        billAmount,
        taxAmount,
        totalAmount,
        carryForwardAmount: 0
      };
    });

    const totalBillAmount = round2(billItems.reduce((sum, item) => sum + item.billAmount, 0));
    const totalTaxAmount = round2(billItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const totalCarryForwardAmount = round2(Array.from(carryForwardsBySourceId.values()).reduce((sum, amount) => sum + amount, 0));
    const totalAmount = round2(billItems.reduce((sum, item) => sum + item.totalAmount, 0) + totalCarryForwardAmount);

    return financialRepository.createRaBill({
      planId: plan.id,
      billName,
      planningType,
      billItems,
      carryForwards: Array.from(carryForwardsBySourceId.entries()).map(([sourceRaBillId, amount]) => ({ sourceRaBillId, amount })),
      totalBillAmount,
      totalTaxAmount,
      totalAmount
    });
  },

  async updateRaBill(raBillId: string, payload: {
    status?: FinancialBillStatus;
    receivedDate?: string | null;
    chequeRtgsAmount?: number;
    itDeductionPct?: number;
    lCessDeductionPct?: number;
    securityDepositPct?: number;
    recoverFromRaBillPct?: number;
    gstWithheldPct?: number;
    withheldPct?: number;
    remark?: string | null;
  }) {
    const existing = await financialRepository.findRaBillById(raBillId);
    if (!existing) {
      throw notFound("RA bill not found");
    }

    const totalAmount = Number(existing.totalAmount ?? 0);

    // Calculate deduction amounts from total
    const itDeductionPct = payload.itDeductionPct !== undefined ? round2(payload.itDeductionPct) : existing.itDeductionPct;
    const lCessDeductionPct = payload.lCessDeductionPct !== undefined ? round2(payload.lCessDeductionPct) : existing.lCessDeductionPct;
    const securityDepositPct = payload.securityDepositPct !== undefined ? round2(payload.securityDepositPct) : existing.securityDepositPct;
    const recoverFromRaBillPct = payload.recoverFromRaBillPct !== undefined ? round2(payload.recoverFromRaBillPct) : existing.recoverFromRaBillPct;
    const gstWithheldPct = payload.gstWithheldPct !== undefined ? round2(payload.gstWithheldPct) : existing.gstWithheldPct;
    const withheldPct = payload.withheldPct !== undefined ? round2(payload.withheldPct) : existing.withheldPct;

    const itDeductionAmount = round2((totalAmount * itDeductionPct) / 100);
    const lCessDeductionAmount = round2((totalAmount * lCessDeductionPct) / 100);
    const securityDepositAmount = round2((totalAmount * securityDepositPct) / 100);
    const recoverFromRaBillAmount = round2((totalAmount * recoverFromRaBillPct) / 100);
    const gstWithheldAmount = round2((totalAmount * gstWithheldPct) / 100);
    const withheldAmount = round2((totalAmount * withheldPct) / 100);

    const chequeRtgsAmount = payload.chequeRtgsAmount !== undefined ? round2(payload.chequeRtgsAmount) : existing.chequeRtgsAmount;
    const totalDeductions = round2(itDeductionAmount + lCessDeductionAmount + securityDepositAmount + recoverFromRaBillAmount + gstWithheldAmount + withheldAmount);
    const totalReceivedAmount = round2(chequeRtgsAmount + totalDeductions);

    if (totalReceivedAmount > totalAmount + 0.0001) {
      throw badRequest("Received amount plus deductions cannot exceed the total bill amount");
    }

    const remainingAmount = round2(Math.max(totalAmount - totalReceivedAmount, 0));
    const allocatedCarryForwardAmount = getAllocatedCarryForwardAmount(existing as CarryForwardRaBill);
    if (remainingAmount + 0.0001 < allocatedCarryForwardAmount) {
      throw badRequest(
        `Remaining amount ${remainingAmount.toFixed(2)} cannot be less than ${allocatedCarryForwardAmount.toFixed(2)} already carried to later bills.`
      );
    }

    const receivedDate = payload.receivedDate !== undefined
      ? (payload.receivedDate ? new Date(payload.receivedDate) : null)
      : existing.receivedDate;

    return financialRepository.updateRaBill({
      raBillId,
      status: payload.status,
      receivedDate,
      chequeRtgsAmount,
      itDeductionPct,
      itDeductionAmount,
      lCessDeductionPct,
      lCessDeductionAmount,
      securityDepositPct,
      securityDepositAmount,
      recoverFromRaBillPct,
      recoverFromRaBillAmount,
      gstWithheldPct,
      gstWithheldAmount,
      withheldPct,
      withheldAmount,
      totalReceivedAmount,
      remark: payload.remark !== undefined ? payload.remark : existing.remark
    });
  },

  // Legacy kept for backward compat
  async createBills(projectId: string, payload: { bills: Array<{ itemId: string; includePreviousRemaining?: boolean; status: FinancialBillStatus; remark?: string | null }> }) {
    const plan = await financialRepository.findPlanByProjectId(projectId);
    if (!plan) {
      throw badRequest("Create financial item planning first");
    }
    const itemIds = new Set<string>(plan.items.map((item: { id: string }) => item.id));
    if (payload.bills.some((bill) => !itemIds.has(bill.itemId))) {
      throw badRequest("One or more selected items do not belong to this project plan");
    }
    return plan;
  },

  async updateBill(billId: string, payload: { status?: FinancialBillStatus; receivedAmount?: number; receivedDate?: Date | null; remark?: string | null }) {
    const existing = await financialRepository.findBillById(billId);
    if (!existing) {
      throw notFound("Financial bill not found");
    }
    return financialRepository.updateBill({ ...payload, billId });
  }
};
