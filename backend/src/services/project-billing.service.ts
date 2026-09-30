import { projectBillingRepository } from "../repositories/project-billing.repository.js";
import { notFound } from "../utils/errors.js";

type BillingEntryFields = {
  date?: string | null;
  raBillNo?: string;
  billNo?: string;
  month?: string;
  basicAmountClaimed?: number;
  basicAmountPassed?: number;
  gstAmount?: number;
  totalAmount?: number;
  tds?: number;
  sdRetention?: number;
  gstDeduction?: number;
  amountToReceive?: number;
  chequeAmount?: number;
  amountHold?: number;
  gstReceived?: number;
};

function round2(value: number) {
  return Number((value ?? 0).toFixed(2));
}

function parseDateField(value?: string | null) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const NUMERIC_FIELDS = [
  "basicAmountClaimed",
  "basicAmountPassed",
  "gstAmount",
  "totalAmount",
  "tds",
  "sdRetention",
  "gstDeduction",
  "amountToReceive",
  "chequeAmount",
  "amountHold",
  "gstReceived"
] as const;

function normalizeNumbers(fields: BillingEntryFields) {
  const out: Record<string, number> = {};
  for (const key of NUMERIC_FIELDS) {
    if (fields[key] !== undefined) out[key] = round2(Number(fields[key]) || 0);
  }
  return out;
}

export const projectBillingService = {
  listByProject(projectId: string) {
    return projectBillingRepository.listByProject(projectId);
  },

  async create(projectId: string, payload: BillingEntryFields) {
    const sortOrder = await projectBillingRepository.nextSortOrder(projectId);
    return projectBillingRepository.create({
      projectId,
      date: parseDateField(payload.date) ?? null,
      raBillNo: payload.raBillNo?.trim() || "",
      billNo: payload.billNo?.trim() || "",
      month: payload.month?.trim() || "",
      sortOrder,
      ...normalizeNumbers(payload)
    });
  },

  async update(id: string, payload: BillingEntryFields) {
    const existing = await projectBillingRepository.findById(id);
    if (!existing) throw notFound("Billing entry not found");
    return projectBillingRepository.update(id, {
      date: parseDateField(payload.date),
      raBillNo: payload.raBillNo?.trim(),
      billNo: payload.billNo?.trim(),
      month: payload.month?.trim(),
      ...normalizeNumbers(payload)
    });
  },

  async remove(id: string) {
    const existing = await projectBillingRepository.findById(id);
    if (!existing) throw notFound("Billing entry not found");
    await projectBillingRepository.delete(id);
    return { deleted: true };
  },

  /** Per-project rollup: how many bills, how many have a cheque amount recorded (passed) vs not (remaining). */
  async getSummary() {
    const projects = await projectBillingRepository.listProjectsWithEntries();

    const rows = projects.map((project) => {
      const entries = project.billingEntries;
      const billsPassed = entries.filter((e) => e.chequeAmount > 0).length;
      const totals = entries.reduce(
        (acc, e) => ({
          basicAmountClaimed: acc.basicAmountClaimed + e.basicAmountClaimed,
          basicAmountPassed: acc.basicAmountPassed + e.basicAmountPassed,
          gstAmount: acc.gstAmount + e.gstAmount,
          totalAmount: acc.totalAmount + e.totalAmount,
          tds: acc.tds + e.tds,
          sdRetention: acc.sdRetention + e.sdRetention,
          gstDeduction: acc.gstDeduction + e.gstDeduction,
          amountToReceive: acc.amountToReceive + e.amountToReceive,
          chequeAmount: acc.chequeAmount + e.chequeAmount,
          amountHold: acc.amountHold + e.amountHold,
          gstReceived: acc.gstReceived + e.gstReceived
        }),
        {
          basicAmountClaimed: 0,
          basicAmountPassed: 0,
          gstAmount: 0,
          totalAmount: 0,
          tds: 0,
          sdRetention: 0,
          gstDeduction: 0,
          amountToReceive: 0,
          chequeAmount: 0,
          amountHold: 0,
          gstReceived: 0
        }
      );

      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.projectNumber,
        billsCount: entries.length,
        billsPassedCount: billsPassed,
        billsRemainingCount: entries.length - billsPassed,
        remainingAmount: round2(totals.totalAmount - totals.chequeAmount),
        basicAmountClaimed: round2(totals.basicAmountClaimed),
        basicAmountPassed: round2(totals.basicAmountPassed),
        gstAmount: round2(totals.gstAmount),
        totalAmount: round2(totals.totalAmount),
        tds: round2(totals.tds),
        sdRetention: round2(totals.sdRetention),
        gstDeduction: round2(totals.gstDeduction),
        amountToReceive: round2(totals.amountToReceive),
        chequeAmount: round2(totals.chequeAmount),
        amountHold: round2(totals.amountHold),
        gstReceived: round2(totals.gstReceived)
      };
    });

    const grandTotal = rows.reduce(
      (acc, row) => ({
        billsCount: acc.billsCount + row.billsCount,
        billsPassedCount: acc.billsPassedCount + row.billsPassedCount,
        billsRemainingCount: acc.billsRemainingCount + row.billsRemainingCount,
        basicAmountClaimed: round2(acc.basicAmountClaimed + row.basicAmountClaimed),
        totalAmount: round2(acc.totalAmount + row.totalAmount),
        chequeAmount: round2(acc.chequeAmount + row.chequeAmount),
        remainingAmount: round2(acc.remainingAmount + row.remainingAmount)
      }),
      {
        billsCount: 0,
        billsPassedCount: 0,
        billsRemainingCount: 0,
        basicAmountClaimed: 0,
        totalAmount: 0,
        chequeAmount: 0,
        remainingAmount: 0
      }
    );

    return { rows, grandTotal };
  }
};
