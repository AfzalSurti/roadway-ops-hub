import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { financialBillStatusConfig, type FinancialBillStatus, type FinancialRaBill } from "@/lib/domain";
import { downloadProperBillPdf, downloadRaBillPdf } from "@/lib/ra-bill-pdf";
import { toast } from "sonner";
import { Download, FileText, Plus, Save, X } from "lucide-react";
import * as XLSX from "xlsx";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function formatPercentage(value: number) {
  return `${round2(value).toFixed(2)}%`;
}

function getBillTotalDeductions(raBill: FinancialRaBill) {
  return round2(
    Number(raBill.itDeductionAmount || 0) +
    Number(raBill.lCessDeductionAmount || 0) +
    Number(raBill.securityDepositAmount || 0) +
    Number(raBill.recoverFromRaBillAmount || 0) +
    Number(raBill.gstWithheldAmount || 0) +
    Number(raBill.withheldAmount || 0)
  );
}

function getRaBillMetrics(raBill: FinancialRaBill) {
  const totalDeductions = getBillTotalDeductions(raBill);
  const totalReceivedAmount = Number(raBill.totalReceivedAmount || 0);
  const remainingAmount = round2(Math.max(Number(raBill.totalAmount || 0) - totalReceivedAmount, 0));
  const receivedPercentage = raBill.totalAmount > 0 ? round2((totalReceivedAmount / raBill.totalAmount) * 100) : 0;
  const usedInLaterBillsAmount = round2((raBill.outgoingCarryForwards ?? []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  const includedFromPreviousBillsAmount = round2((raBill.incomingCarryForwards ?? []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
  const availableCarryForwardAmount = round2(Math.max(remainingAmount - usedInLaterBillsAmount, 0));
  return {
    totalDeductions,
    totalReceivedAmount,
    remainingAmount,
    receivedPercentage,
    usedInLaterBillsAmount,
    includedFromPreviousBillsAmount,
    availableCarryForwardAmount
  };
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type BillItemRow = {
  itemId: string;
  billPercentage: string;
};

type CarryForwardRow = {
  sourceRaBillId: string;
  percentage: string;
  amount: string;
};

type PlanningRow = {
  itemNumber: number;
  particulars: string;
  percentage: string;
  amount: string;
};

type DeductionState = {
  chequeRtgsAmount: string;
  itDeductionPct: string;
  lCessDeductionPct: string;
  securityDepositPct: string;
  recoverFromRaBillPct: string;
  gstWithheldPct: string;
  withheldPct: string;
  receivedDate: string;
  remark: string;
};

type PlanningType = "NORMAL" | "EXCESS";

export default function AdminFinancial() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showPlanning, setShowPlanning] = useState(false);
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [showCarryRecord, setShowCarryRecord] = useState(false);
  const [planningType, setPlanningType] = useState<PlanningType>("NORMAL");
  const [billPlanningType, setBillPlanningType] = useState<PlanningType>("NORMAL");
  const [planningRows, setPlanningRows] = useState<PlanningRow[]>([]);
  const [excessBaseAmount, setExcessBaseAmount] = useState("");
  const [billItemRows, setBillItemRows] = useState<BillItemRow[]>([]);
  const [carryForwardRows, setCarryForwardRows] = useState<CarryForwardRow[]>([]);
  // Deduction popup state: raBillId | null
  const [deductionPopup, setDeductionPopup] = useState<{ raBillId: string; totalAmount: number } | null>(null);
  const [deductionState, setDeductionState] = useState<DeductionState>({
    chequeRtgsAmount: "",
    itDeductionPct: "",
    lCessDeductionPct: "",
    securityDepositPct: "",
    recoverFromRaBillPct: "",
    gstWithheldPct: "",
    withheldPct: "",
    receivedDate: "",
    remark: ""
  });

  const { data: eligibleProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["financial-projects"],
    queryFn: () => api.getFinancialProjects(),
    staleTime: 5 * 60 * 1000
  });

  const activeProjectId = selectedProjectId || eligibleProjects[0]?.id || "";

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["financial-project", activeProjectId],
    queryFn: () => api.getProjectFinancial(activeProjectId),
    enabled: Boolean(activeProjectId),
    staleTime: 2 * 60 * 1000
  });

  const raBills = detail?.plan?.raBills ?? [];

  const itemsByType = useMemo(() => {
    const items = detail?.plan?.items ?? [];
    return {
      NORMAL: items.filter((item) => (item.planningType ?? "NORMAL") === "NORMAL"),
      EXCESS: items.filter((item) => (item.planningType ?? "NORMAL") === "EXCESS")
    } as const;
  }, [detail?.plan?.items]);

  useEffect(() => {
    if (!detail) return;
    const sourceItems = itemsByType[planningType];
    const source = sourceItems.length
      ? sourceItems.map((item) => ({ itemNumber: item.itemNumber, particulars: item.particulars, percentage: String(item.percentage), amount: String(item.amount) }))
      : planningType === "NORMAL"
        ? detail.itemTemplates.map((item) => ({ itemNumber: item.itemNumber, particulars: item.particulars, percentage: "0", amount: "0" }))
        : [{ itemNumber: 1, particulars: "", percentage: "0", amount: "0" }];
    setPlanningRows(source);
    if (planningType === "EXCESS") {
      const existingExcessAmount = round2(sourceItems.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      setExcessBaseAmount(existingExcessAmount > 0 ? String(existingExcessAmount) : "");
    } else {
      setExcessBaseAmount("");
    }
  }, [detail?.plan?.updatedAt, detail?.project?.id, planningType, itemsByType]);

  const totalPercentage = useMemo(
    () => planningRows.reduce((sum, item) => sum + Number(item.percentage || 0), 0),
    [planningRows]
  );

  const totalPlanningAmount = useMemo(
    () => round2(planningRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    [planningRows]
  );

  const excessTaxAmount = useMemo(
    () => round2(Number(excessBaseAmount || 0) * 0.18),
    [excessBaseAmount]
  );

  const totalExcessAmount = useMemo(
    () => round2(Number(excessBaseAmount || 0) + excessTaxAmount),
    [excessBaseAmount, excessTaxAmount]
  );

  const addPlanningRow = () => {
    const nextNumber = planningRows.length > 0 ? Math.max(...planningRows.map((row) => row.itemNumber)) + 1 : 1;
    setPlanningRows((prev) => [...prev, { itemNumber: nextNumber, particulars: "", percentage: "0", amount: "0" }]);
  };

  const removePlanningRow = (index: number) => {
    setPlanningRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePlanningRow = (index: number, patch: Partial<PlanningRow>) => {
    setPlanningRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const savePlanMutation = useMutation({
    mutationFn: () => {
      if (!activeProjectId) {
        throw new Error("Please select a project before saving planning.");
      }
      if (planningType === "EXCESS") {
        const base = Number(excessBaseAmount || 0);
        if (base <= 0) {
          throw new Error("Please enter Excess Amount before saving Excess Planning.");
        }
        if (totalPlanningAmount > base + 0.0001) {
          throw new Error("Total item amount cannot be greater than Excess Amount.");
        }
      }
      return api.upsertFinancialPlan(activeProjectId, {
        planningType,
        items: planningRows.map((item) => ({
          itemNumber: Number(item.itemNumber),
          particulars: item.particulars.trim(),
          percentage: planningType === "EXCESS"
            ? (Number(excessBaseAmount || 0) > 0 ? round2((Number(item.amount || 0) / Number(excessBaseAmount || 0)) * 100) : 0)
            : Number(item.percentage || 0)
        }))
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", activeProjectId] });
      setShowPlanning(false);
      toast.success("Financial tender item saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save financial planning");
    }
  });

  // Compute bill amounts for create-bill modal preview
  const billItemPreviews = useMemo(() => {
    if (!detail?.plan) return [];
    const previousUsageByItemId = new Map<string, { usedPercentage: number; bills: Array<{ billName: string; billPercentage: number }> }>();

    for (const raBill of raBills) {
      if ((raBill.planningType ?? "NORMAL") !== billPlanningType) continue;
      for (const billItem of raBill.items) {
        const current = previousUsageByItemId.get(billItem.itemId) ?? { usedPercentage: 0, bills: [] };
        current.usedPercentage = round2(current.usedPercentage + billItem.billPercentage);
        current.bills.push({ billName: raBill.billName, billPercentage: billItem.billPercentage });
        previousUsageByItemId.set(billItem.itemId, current);
      }
    }

    const draftedUsageByItemId = new Map<string, number>();

    return billItemRows.map((row) => {
      const planItem = detail.plan!.items.find((i) => i.id === row.itemId && (i.planningType ?? "NORMAL") === billPlanningType);
      if (!planItem) return null;
      const previousUsage = previousUsageByItemId.get(row.itemId);
      const previousUsed = previousUsage?.usedPercentage ?? 0;
      const draftedUsedBeforeRow = draftedUsageByItemId.get(row.itemId) ?? 0;
      const remainingBeforeRow = round2(Math.max(planItem.percentage - previousUsed - draftedUsedBeforeRow, 0));
      const billPct = Number(row.billPercentage || 0);
      const fraction = planItem.percentage > 0 ? billPct / planItem.percentage : 0;
      const amount = planItem.amount * fraction;
      const tax = amount * 0.18;
      const total = amount + tax;
      draftedUsageByItemId.set(row.itemId, round2(draftedUsedBeforeRow + billPct));
      return {
        planItem,
        billPct,
        amount,
        tax,
        total,
        previousUsed,
        usedInBills: previousUsage?.bills ?? [],
        remainingBeforeRow,
        exceedsRemaining: billPct > remainingBeforeRow + 0.0001
      };
    });
  }, [billItemRows, billPlanningType, detail?.plan, raBills]);

  const billTotals = useMemo(() => {
    const previews = billItemPreviews.filter(Boolean) as NonNullable<typeof billItemPreviews[number]>[];
    return {
      amount: previews.reduce((sum, preview) => sum + preview.amount, 0),
      tax: previews.reduce((sum, preview) => sum + preview.tax, 0),
      total: previews.reduce((sum, preview) => sum + preview.total, 0)
    };
  }, [billItemPreviews]);

  const carryForwardSourceOptions = useMemo(
    () => raBills
      .filter((raBill) => raBill.status === "RECEIVED" && (raBill.planningType ?? "NORMAL") === billPlanningType)
      .map((raBill) => ({ raBill, ...getRaBillMetrics(raBill) }))
      .filter((entry) => entry.availableCarryForwardAmount > 0.01),
    [billPlanningType, raBills]
  );

  const carryForwardPreviews = useMemo(() => {
    const selectedCount = new Map<string, number>();
    return carryForwardRows.map((row) => {
      const sourceOption = carryForwardSourceOptions.find((entry) => entry.raBill.id === row.sourceRaBillId);
      const amount = Number(row.amount || 0);
      const percentage = Number(row.percentage || 0);
      const nextCount = row.sourceRaBillId ? (selectedCount.get(row.sourceRaBillId) ?? 0) + 1 : 0;
      if (row.sourceRaBillId) {
        selectedCount.set(row.sourceRaBillId, nextCount);
      }
      const duplicateSelection = Boolean(row.sourceRaBillId) && nextCount > 1;
      const availableAmount = sourceOption?.availableCarryForwardAmount ?? 0;
      const exceedsAvailable = amount > availableAmount + 0.0001;
      return {
        sourceOption,
        amount,
        percentage,
        availableAmount,
        duplicateSelection,
        exceedsAvailable
      };
    });
  }, [carryForwardRows, carryForwardSourceOptions]);

  const totalCarryForwardAmount = useMemo(
    () => round2(carryForwardPreviews.reduce((sum, preview) => sum + (preview.sourceOption ? preview.amount : 0), 0)),
    [carryForwardPreviews]
  );

  const hasInvalidBillRows = useMemo(
    () => billItemPreviews.some((preview) => Boolean(preview?.exceedsRemaining)),
    [billItemPreviews]
  );

  const hasInvalidCarryForwardRows = useMemo(
    () => carryForwardRows.some((row) => !row.sourceRaBillId || !row.amount || Number(row.amount) <= 0)
      || carryForwardPreviews.some((preview) => preview.duplicateSelection || preview.exceedsAvailable || !preview.sourceOption),
    [carryForwardPreviews, carryForwardRows]
  );

  const createRaBillMutation = useMutation({
    mutationFn: () => {
      if (!activeProjectId) {
        throw new Error("Please select a project before creating RA bill.");
      }
      const invalidPreview = billItemPreviews.find((preview) => preview?.exceedsRemaining);
      if (invalidPreview) {
        throw new Error(
          `Item ${invalidPreview.planItem.itemNumber} has only ${formatPercentage(invalidPreview.remainingBeforeRow)} remaining for this bill.`
        );
      }
      const invalidCarryForwardPreview = carryForwardPreviews.find((preview) => preview.duplicateSelection || preview.exceedsAvailable || !preview.sourceOption);
      if (invalidCarryForwardPreview?.duplicateSelection) {
        throw new Error("A previous bill can be selected only once in carry forward.");
      }
      if (invalidCarryForwardPreview?.exceedsAvailable) {
        throw new Error(`Carry forward amount cannot exceed ${money(invalidCarryForwardPreview.availableAmount)}.`);
      }
      return api.createRaBill(activeProjectId, {
        planningType: billPlanningType,
        items: billItemRows
          .filter((row) => row.itemId && Number(row.billPercentage) > 0)
          .map((row) => ({ itemId: row.itemId, billPercentage: Number(row.billPercentage) })),
        carryForwards: carryForwardRows
          .filter((row) => row.sourceRaBillId && Number(row.amount) > 0)
          .map((row) => ({ sourceRaBillId: row.sourceRaBillId, amount: Number(row.amount) }))
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", activeProjectId] });
      setShowCreateBill(false);
      setBillItemRows([]);
      setCarryForwardRows([]);
      toast.success("RA bill created");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create RA bill");
    }
  });

  const updateRaBillMutation = useMutation({
    mutationFn: (args: { raBillId: string; payload: Parameters<typeof api.updateRaBill>[1] }) =>
      api.updateRaBill(args.raBillId, args.payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", activeProjectId] });
      setDeductionPopup(null);
      toast.success("RA bill updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update RA bill");
    }
  });

  function openCreateBill(type: PlanningType) {
    const sourceItems = itemsByType[type];
    if (!sourceItems.length) return;
    setBillPlanningType(type);
    setBillItemRows([{ itemId: sourceItems[0].id, billPercentage: "" }]);
    setCarryForwardRows([]);
    setShowCreateBill(true);
  }

  function openPlanning(type: PlanningType) {
    setPlanningType(type);
    setShowPlanning(true);
  }

  function addBillItemRow() {
    const sourceItems = itemsByType[billPlanningType];
    if (!sourceItems.length) return;
    setBillItemRows((prev) => [...prev, { itemId: sourceItems[0].id, billPercentage: "" }]);
  }

  function removeBillItemRow(index: number) {
    setBillItemRows((prev) => prev.filter((_, i) => i !== index));
  }

  function getCarryForwardAvailableAmount(sourceRaBillId: string) {
    return carryForwardSourceOptions.find((entry) => entry.raBill.id === sourceRaBillId)?.availableCarryForwardAmount ?? 0;
  }

  function addCarryForwardRow() {
    setCarryForwardRows((prev) => [...prev, { sourceRaBillId: "", percentage: "", amount: "" }]);
  }

  function removeCarryForwardRow(index: number) {
    setCarryForwardRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCarryForwardRow(index: number, patch: Partial<CarryForwardRow>) {
    setCarryForwardRows((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, ...patch };
      if (patch.sourceRaBillId !== undefined) {
        return { sourceRaBillId: patch.sourceRaBillId, percentage: "", amount: "" };
      }
      const availableAmount = getCarryForwardAvailableAmount(next.sourceRaBillId);
      if (patch.amount !== undefined) {
        const amount = Number(patch.amount || 0);
        return {
          ...next,
          percentage: availableAmount > 0 && Number.isFinite(amount) ? String(round2((amount / availableAmount) * 100)) : ""
        };
      }
      if (patch.percentage !== undefined) {
        const percentage = Number(patch.percentage || 0);
        return {
          ...next,
          amount: availableAmount > 0 && Number.isFinite(percentage) ? String(round2((availableAmount * percentage) / 100)) : ""
        };
      }
      return next;
    }));
  }

  function openDeductionPopup(raBill: FinancialRaBill) {
    setDeductionState({
      chequeRtgsAmount: raBill.chequeRtgsAmount > 0 ? String(raBill.chequeRtgsAmount) : "",
      itDeductionPct: raBill.itDeductionPct > 0 ? String(raBill.itDeductionPct) : "",
      lCessDeductionPct: raBill.lCessDeductionPct > 0 ? String(raBill.lCessDeductionPct) : "",
      securityDepositPct: raBill.securityDepositPct > 0 ? String(raBill.securityDepositPct) : "",
      recoverFromRaBillPct: raBill.recoverFromRaBillPct > 0 ? String(raBill.recoverFromRaBillPct) : "",
      gstWithheldPct: raBill.gstWithheldPct > 0 ? String(raBill.gstWithheldPct) : "",
      withheldPct: raBill.withheldPct > 0 ? String(raBill.withheldPct) : "",
      receivedDate: raBill.receivedDate ? raBill.receivedDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      remark: raBill.remark ?? ""
    });
    setDeductionPopup({ raBillId: raBill.id, totalAmount: raBill.totalAmount });
  }

  // Compute deduction amounts in real time for the popup
  const deductionAmounts = useMemo(() => {
    if (!deductionPopup) return null;
    const total = deductionPopup.totalAmount;
    const receivedAmount = Number(deductionState.chequeRtgsAmount || 0);
    const it = Number(deductionState.itDeductionPct || 0);
    const lcess = Number(deductionState.lCessDeductionPct || 0);
    const sd = Number(deductionState.securityDepositPct || 0);
    const recover = Number(deductionState.recoverFromRaBillPct || 0);
    const gstw = Number(deductionState.gstWithheldPct || 0);
    const wh = Number(deductionState.withheldPct || 0);

    const itAmt = (total * it) / 100;
    const lcessAmt = (total * lcess) / 100;
    const sdAmt = (total * sd) / 100;
    const recoverAmt = (total * recover) / 100;
    const gstwAmt = (total * gstw) / 100;
    const whAmt = (total * wh) / 100;
    const totalDeductions = itAmt + lcessAmt + sdAmt + recoverAmt + gstwAmt + whAmt;
    const totalReceived = receivedAmount + totalDeductions;
    const receivedPercentage = total > 0 ? round2((totalReceived / total) * 100) : 0;
    const remainingAmount = round2(Math.max(total - totalReceived, 0));

    return {
      itAmt,
      lcessAmt,
      sdAmt,
      recoverAmt,
      gstwAmt,
      whAmt,
      totalDeductions,
      totalReceived,
      receivedAmount,
      receivedPercentage,
      remainingAmount,
      totalBillAmount: total
    };
  }, [deductionPopup, deductionState]);

  function submitDeductions() {
    if (!deductionPopup) return;
    updateRaBillMutation.mutate({
      raBillId: deductionPopup.raBillId,
      payload: {
        status: "RECEIVED",
        receivedDate: deductionState.receivedDate || null,
        chequeRtgsAmount: Number(deductionState.chequeRtgsAmount || 0),
        itDeductionPct: Number(deductionState.itDeductionPct || 0),
        lCessDeductionPct: Number(deductionState.lCessDeductionPct || 0),
        securityDepositPct: Number(deductionState.securityDepositPct || 0),
        recoverFromRaBillPct: Number(deductionState.recoverFromRaBillPct || 0),
        gstWithheldPct: Number(deductionState.gstWithheldPct || 0),
        withheldPct: Number(deductionState.withheldPct || 0),
        remark: deductionState.remark || null
      }
    });
  }

  function handleStatusChange(raBill: FinancialRaBill, newStatus: FinancialBillStatus) {
    if (newStatus === "RECEIVED") {
      openDeductionPopup(raBill);
    } else {
      updateRaBillMutation.mutate({ raBillId: raBill.id, payload: { status: newStatus } });
    }
  }

  function handleDownloadPdf() {
    if (!detail?.plan) return;
    downloadRaBillPdf({
      plan: detail.plan,
      projectNumber: detail.project.projectNumber,
      projectName: detail.project.name,
      raBills: detail.plan.raBills
    });
  }

  function handleDownloadSingleBillPdf(raBill: FinancialRaBill) {
    if (!detail?.plan) return;
    downloadRaBillPdf({
      plan: detail.plan,
      projectNumber: detail.project.projectNumber,
      projectName: detail.project.name,
      raBills: [raBill],
      fileName: `${raBill.billName}_${detail.project.projectNumber}`
    });
  }

  function handleDownloadSingleProperBillPdf(raBill: FinancialRaBill) {
    if (!detail?.project) return;
    downloadProperBillPdf({
      projectNumber: detail.project.projectNumber,
      projectName: detail.project.name,
      raBill,
      workOrderNumber: detail.project.workOrderNumber,
      workOrderDate: detail.project.workOrderDate,
      billingName: detail.project.billingName,
      designation: detail.project.designation,
      department: detail.project.department,
      addressWithPincode: detail.project.addressWithPincode,
      nameOfWork: detail.project.nameOfWork,
      panTanNumber: detail.project.panTanNumber,
      gstNumber: detail.project.gstNumber
    });
  }

  async function handleDownloadAllProjectsBillStatus() {
    try {
      const summary = await api.getAllProjectsBillStatus();
      if (!summary.rows.length) {
        toast.error("No financial bill status data available for export.");
        return;
      }

      const rows: Array<Record<string, string | number>> = summary.rows.map((row, index) => ({
        "S.No": index + 1,
        "Folder No": row.folderNo || "",
        "DPR Project": row.dprProject,
        "Project No.": row.projectNo,
        "WO Amount (Excl. GST)": row.workOrderAmountExclGst,
        "Received Amount (Excl. GST)": row.receivedAmountExclGst,
        "Financial Progress %": row.financialProgressPct,
        "RA Bill Raised/Claim": row.raBillRaisedClaim,
        Planning: row.planningAmount,
        "Total Excess (Excl. GST)": row.totalExcessExclGst,
        "Excess Received": row.excessReceived,
        "Excess Bill Raised/Claim": row.excessBillRaisedClaim,
        Remark: row.remark || ""
      }));

      const totals = summary.rows.reduce((acc, row) => ({
        workOrderAmountExclGst: acc.workOrderAmountExclGst + row.workOrderAmountExclGst,
        receivedAmountExclGst: acc.receivedAmountExclGst + row.receivedAmountExclGst,
        raBillRaisedClaim: acc.raBillRaisedClaim + row.raBillRaisedClaim,
        planningAmount: acc.planningAmount + row.planningAmount,
        totalExcessExclGst: acc.totalExcessExclGst + row.totalExcessExclGst,
        excessReceived: acc.excessReceived + row.excessReceived,
        excessBillRaisedClaim: acc.excessBillRaisedClaim + row.excessBillRaisedClaim
      }), {
        workOrderAmountExclGst: 0,
        receivedAmountExclGst: 0,
        raBillRaisedClaim: 0,
        planningAmount: 0,
        totalExcessExclGst: 0,
        excessReceived: 0,
        excessBillRaisedClaim: 0
      });

      rows.push({
        "S.No": "",
        "Folder No": "",
        "DPR Project": "Total",
        "Project No.": "",
        "WO Amount (Excl. GST)": round2(totals.workOrderAmountExclGst),
        "Received Amount (Excl. GST)": round2(totals.receivedAmountExclGst),
        "Financial Progress %": round2(totals.workOrderAmountExclGst > 0 ? (totals.receivedAmountExclGst / totals.workOrderAmountExclGst) * 100 : 0),
        "RA Bill Raised/Claim": round2(totals.raBillRaisedClaim),
        Planning: round2(totals.planningAmount),
        "Total Excess (Excl. GST)": round2(totals.totalExcessExclGst),
        "Excess Received": round2(totals.excessReceived),
        "Excess Bill Raised/Claim": round2(totals.excessBillRaisedClaim),
        Remark: ""
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bill Status");
      const datePart = summary.generatedAt.slice(0, 10);
      XLSX.writeFile(workbook, `all-project-bill-status-${datePart}.xlsx`);

      if (summary.missingColumns.length > 0) {
        toast.success(`Downloaded bill status. Missing columns in current data: ${summary.missingColumns.join(", ")}.`);
      } else {
        toast.success("Downloaded all-project bill status.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download all-project bill status");
    }
  }

  const carryForwardMovements = useMemo(
    () => raBills.flatMap((raBill) =>
      (raBill.outgoingCarryForwards ?? []).map((entry) => ({
        sourceBillName: raBill.billName,
        targetBillName: entry.targetRaBill?.billName ?? "-",
        amount: entry.amount,
        planningType: raBill.planningType ?? "NORMAL"
      }))
    ),
    [raBills]
  );

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Financial</h1>
        <p className="page-subtitle">Plan project financial items, create RA bills, and track received payments</p>
      </div>

      {/* Project selector */}
      <div className="glass-panel p-4 mb-6">
        <label className="text-sm font-medium mb-2 block">Select Eligible Project</label>
        <select
          value={activeProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full max-w-xl px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50"
          title="Select project for financial planning"
          aria-label="Select project for financial planning"
        >
          {loadingProjects ? <option>Loading projects...</option> : null}
          {!loadingProjects && eligibleProjects.length === 0 ? <option value="">No eligible projects</option> : null}
          {!loadingProjects && eligibleProjects.map((project) => (
            <option key={project.id} value={project.id}>{project.projectNumber} - {project.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-2">
          Only projects with assigned project number and completed project requisition form can use Financial.
        </p>
      </div>

      {!activeProjectId || !detail ? (
        <div className="glass-panel p-8 text-sm text-muted-foreground">
          {loadingDetail ? "Loading financial details..." : "Select a project to continue."}
        </div>
      ) : (
        <>
          {/* Project summary */}
          <div className="glass-panel p-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
                <DetailTile label="Project" value={`${detail.project.projectNumber} - ${detail.project.name}`} />
                <DetailTile label="Contract Value" value={money(detail.project.contractValue)} />
                <DetailTile label="Tax (18%)" value={money(detail.project.taxAmount)} />
                <DetailTile label="Total Amount" value={money(detail.project.totalAmount)} />
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadAllProjectsBillStatus}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/50 text-foreground border border-border/50 text-sm font-medium hover:bg-secondary/70"
                  >
                    <Download className="h-4 w-4" />
                    Download All Project Status
                  </button>
                  <button
                    onClick={() => openPlanning("NORMAL")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20"
                  >
                    <Save className="h-4 w-4" />
                    Tender Item
                  </button>
                  <button
                    onClick={() => openCreateBill("NORMAL")}
                    disabled={!detail.plan || itemsByType.NORMAL.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Create RA Bill
                  </button>
                  {raBills.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowCarryRecord(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/50 text-foreground border border-border/50 text-sm font-medium hover:bg-secondary/70"
                      >
                        <FileText className="h-4 w-4" />
                        Carry Forward Record
                      </button>
                      <button
                        onClick={handleDownloadPdf}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openPlanning("EXCESS")}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-medium hover:bg-warning/20"
                  >
                    <Save className="h-4 w-4" />
                    Excess Planning
                  </button>
                  <button
                    onClick={() => openCreateBill("EXCESS")}
                    disabled={!detail.plan || itemsByType.EXCESS.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-medium hover:bg-warning/20 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Create Excess Bill
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bill Log */}
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Bill Log</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Track RA bills and update status when payment is received</p>
              </div>
            </div>

            {!detail.plan || raBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RA bills created yet. Click "Create RA Bill" to begin.</p>
            ) : (
              <div className="space-y-6">
                <BillGroupSection
                  title="Normal Bills"
                  bills={raBills.filter((bill) => (bill.planningType ?? "NORMAL") === "NORMAL")}
                  onStatusChange={handleStatusChange}
                  onReceivedClick={openDeductionPopup}
                  onDownloadLogPdf={handleDownloadSingleBillPdf}
                  onDownloadProperPdf={handleDownloadSingleProperBillPdf}
                  isPending={updateRaBillMutation.isPending}
                />
                <BillGroupSection
                  title="Excess Bills"
                  bills={raBills.filter((bill) => (bill.planningType ?? "NORMAL") === "EXCESS")}
                  onStatusChange={handleStatusChange}
                  onReceivedClick={openDeductionPopup}
                  onDownloadLogPdf={handleDownloadSingleBillPdf}
                  onDownloadProperPdf={handleDownloadSingleProperBillPdf}
                  isPending={updateRaBillMutation.isPending}
                />
              </div>
            )}
          </div>

          {/* Tender Item Modal */}
          {showPlanning && (
            <FinancialModal title={planningType === "EXCESS" ? "Excess Planning" : "Tender Item"} onClose={() => setShowPlanning(false)}>
              {planningType === "EXCESS" ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4 text-sm">
                  <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Excess Amount</p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={excessBaseAmount}
                      onChange={(e) => setExcessBaseAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
                      placeholder="Enter excess amount"
                      title="Excess amount"
                      aria-label="Excess amount"
                    />
                  </div>
                  <DetailTile label="Tax (18%)" value={money(excessTaxAmount)} />
                  <DetailTile label="Total Excess Amount" value={money(totalExcessAmount)} />
                  <DetailTile
                    label="Item Amount Total"
                    value={money(totalPlanningAmount)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                  <DetailTile label="Contract Value" value={money(detail.project.contractValue)} />
                  <DetailTile label="Tax" value={money(detail.project.taxAmount)} />
                  <DetailTile label="Total Amount" value={money(detail.project.totalAmount)} />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Sr. No.</th>
                      <th className="text-left p-3 font-medium">Particulars</th>
                      <th className="text-left p-3 font-medium">{planningType === "EXCESS" ? "Amount" : "Percentage"}</th>
                      <th className="text-left p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Tax (18%)</th>
                      <th className="text-left p-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningRows.map((item, index) => {
                      const percentage = Number(item.percentage || 0);
                      const amount = planningType === "EXCESS"
                        ? Number(item.amount || 0)
                        : (detail.project.contractValue * percentage) / 100;
                      const tax = amount * 0.18;
                      const total = amount + tax;
                      return (
                        <tr key={`${item.itemNumber}-${index}`} className="border-b border-border/20 align-top">
                          <td className="p-3 font-medium w-28">
                            <input
                              type="number" min="1" step="1"
                              value={item.itemNumber}
                              onChange={(e) => updatePlanningRow(index, { itemNumber: Number(e.target.value || 0) })}
                              className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Item number row ${index + 1}`}
                              aria-label={`Item number row ${index + 1}`}
                            />
                          </td>
                          <td className="p-3 leading-6">
                            <textarea
                              value={item.particulars}
                              onChange={(e) => updatePlanningRow(index, { particulars: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 resize-y"
                              title={`Particulars row ${index + 1}`}
                              aria-label={`Particulars row ${index + 1}`}
                            />
                          </td>
                          <td className="p-3 w-36">
                            <div className="flex items-center gap-2">
                              {planningType === "EXCESS" ? (
                                <input
                                  type="number" min="0" step="0.01"
                                  value={item.amount}
                                  onChange={(e) => {
                                    const nextAmount = e.target.value;
                                    const base = Number(excessBaseAmount || 0);
                                    updatePlanningRow(index, {
                                      amount: nextAmount,
                                      percentage: base > 0 ? String(round2((Number(nextAmount || 0) / base) * 100)) : "0"
                                    });
                                  }}
                                  className="w-28 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                                  title={`Amount for item ${item.itemNumber}`}
                                  aria-label={`Amount for item ${item.itemNumber}`}
                                />
                              ) : (
                                <>
                                  <input
                                    type="number" min="0" max="100" step="0.01"
                                    value={item.percentage}
                                    onChange={(e) => updatePlanningRow(index, { percentage: e.target.value })}
                                    className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                                    title={`Percentage for item ${item.itemNumber}`}
                                    aria-label={`Percentage for item ${item.itemNumber}`}
                                  />
                                  <span>%</span>
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removePlanningRow(index)}
                              disabled={planningRows.length <= 1}
                              className="mt-2 text-xs text-destructive disabled:text-muted-foreground"
                            >
                              Remove
                            </button>
                          </td>
                          <td className="p-3 font-medium">{money(amount)}</td>
                          <td className="p-3 font-medium">{money(tax)}</td>
                          <td className="p-3 font-medium">{money(total)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-secondary/20 font-medium">
                      <td className="p-3" colSpan={2}>Total</td>
                      {planningType === "EXCESS" ? (
                        <>
                          <td className="p-3 text-muted-foreground">-</td>
                          <td className={`p-3 ${totalPlanningAmount > Number(excessBaseAmount || 0) + 0.0001 ? "text-destructive" : "text-accent"}`}>{money(totalPlanningAmount)}</td>
                          <td className="p-3">{money(totalPlanningAmount * 0.18)}</td>
                          <td className="p-3">{money(totalPlanningAmount * 1.18)}</td>
                        </>
                      ) : (
                        <>
                          <td className={`p-3 ${Math.abs(totalPercentage - 100) > 0.01 ? "text-destructive" : "text-accent"}`}>{totalPercentage.toFixed(2)}%</td>
                          <td className="p-3">{money(detail.project.contractValue)}</td>
                          <td className="p-3">{money(detail.project.taxAmount)}</td>
                          <td className="p-3">{money(detail.project.totalAmount)}</td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <button type="button" onClick={addPlanningRow} className="px-4 py-2 rounded-xl border border-border/50 text-sm hover:bg-secondary/40">
                  Add Item
                </button>
                <button
                  onClick={() => savePlanMutation.mutate()}
                  disabled={
                    savePlanMutation.isPending
                    || planningRows.some((row) => !row.particulars.trim() || row.itemNumber < 1)
                    || (planningType === "EXCESS" && Number(excessBaseAmount || 0) <= 0)
                    || (planningType === "EXCESS" && totalPlanningAmount > Number(excessBaseAmount || 0) + 0.0001)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savePlanMutation.isPending ? "Saving..." : "Save Planning"}
                </button>
              </div>
            </FinancialModal>
          )}

          {/* Create RA Bill Modal */}
          {showCreateBill && detail.plan && (
            <FinancialModal title={billPlanningType === "EXCESS" ? "Create New Excess Bill" : "Create New RA Bill"} onClose={() => setShowCreateBill(false)}>
              <p className="text-sm text-muted-foreground mb-4">
                For each item, enter the bill percentage - this is the percentage <em>of that item&apos;s allocated percentage</em>.
                E.g., if Item 1 has 10% and you enter 4%, the bill takes 4% out of its 10%.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Below the tender items, you can also include remaining amount from earlier received bills of the same type.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Bill Type: <span className="font-medium">{billPlanningType === "EXCESS" ? "Excess" : "Normal"}</span>
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1080px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Particulars</th>
                      <th className="text-left p-3 font-medium">Item %</th>
                      <th className="text-left p-3 font-medium">Used in Bills</th>
                      <th className="text-left p-3 font-medium">Remaining %</th>
                      <th className="text-left p-3 font-medium">Bill % (of item %)</th>
                      <th className="text-left p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Tax (18%)</th>
                      <th className="text-left p-3 font-medium">Total</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItemRows.map((row, index) => {
                      const preview = billItemPreviews[index];
                      const planItem = preview?.planItem;
                      return (
                        <tr key={index} className="border-b border-border/20 align-top">
                          <td className="p-3 w-32">
                            <select
                              value={row.itemId}
                              onChange={(e) => setBillItemRows((prev) => prev.map((r, i) => i === index ? { ...r, itemId: e.target.value } : r))}
                              className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-xs"
                              title={`Item selector for row ${index + 1}`}
                              aria-label={`Item selector for row ${index + 1}`}
                            >
                              {itemsByType[billPlanningType].map((item) => (
                                <option key={item.id} value={item.id}>Item {item.itemNumber}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px] leading-5">
                            {planItem?.particulars.slice(0, 80)}{planItem && planItem.particulars.length > 80 ? "..." : ""}
                          </td>
                          <td className="p-3 text-sm font-medium">{planItem ? formatPercentage(planItem.percentage) : "-"}</td>
                          <td className="p-3 text-xs text-muted-foreground min-w-[180px] leading-5">
                            {preview?.usedInBills.length ? (
                              <div className="space-y-1">
                                {preview.usedInBills.map((usage) => (
                                  <div key={`${usage.billName}-${usage.billPercentage}`}>
                                    <span className="font-medium text-foreground">{usage.billName}</span>: {formatPercentage(usage.billPercentage)}
                                  </div>
                                ))}
                              </div>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-sm font-medium">{preview ? formatPercentage(preview.remainingBeforeRow) : "-"}</td>
                          <td className="p-3 w-36">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max={preview?.remainingBeforeRow ?? planItem?.percentage ?? 100}
                                step="0.01"
                                value={row.billPercentage}
                                onChange={(e) => setBillItemRows((prev) => prev.map((r, i) => i === index ? { ...r, billPercentage: e.target.value } : r))}
                                className={`w-24 px-3 py-2 rounded-xl bg-secondary/50 border ${preview?.exceedsRemaining ? "border-destructive text-destructive" : "border-border/50"}`}
                                title={`Bill percentage for row ${index + 1}`}
                                aria-label={`Bill percentage for row ${index + 1}`}
                                placeholder="e.g. 4"
                              />
                              <span className="text-xs">%</span>
                            </div>
                            {preview?.exceedsRemaining ? <p className="mt-1 text-[11px] text-destructive">Only {formatPercentage(preview.remainingBeforeRow)} is left.</p> : null}
                          </td>
                          <td className="p-3 font-medium text-sm">{preview ? money(preview.amount) : "-"}</td>
                          <td className="p-3 font-medium text-sm">{preview ? money(preview.tax) : "-"}</td>
                          <td className="p-3 font-medium text-sm">{preview ? money(preview.total) : "-"}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => removeBillItemRow(index)}
                              disabled={billItemRows.length <= 1}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive disabled:text-muted-foreground"
                              title="Remove item"
                              aria-label="Remove item"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-secondary/20 font-semibold text-sm">
                      <td className="p-3" colSpan={6}>Tender Item Total</td>
                      <td className="p-3">{money(billTotals.amount)}</td>
                      <td className="p-3">{money(billTotals.tax)}</td>
                      <td className="p-3">{money(billTotals.total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 rounded-2xl border border-border/40 bg-secondary/10 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold">Carry Forward From Previous Bills</h4>
                    <p className="text-xs text-muted-foreground mt-1">Use any remaining amount from earlier received bills. You can enter either percentage of remaining amount or direct amount.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addCarryForwardRow}
                    disabled={carryForwardSourceOptions.length === 0}
                    className="px-4 py-2 rounded-xl border border-border/50 text-sm hover:bg-secondary/40 disabled:opacity-50"
                  >
                    + Add Previous Bill
                  </button>
                </div>

                {carryForwardSourceOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No received bills currently have remaining amount available for carry forward.</p>
                ) : carryForwardRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No previous bill amount added yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="border-b border-border/40 text-muted-foreground">
                          <th className="text-left p-3 font-medium">Source Bill</th>
                          <th className="text-left p-3 font-medium">Total Received</th>
                          <th className="text-left p-3 font-medium">Remaining Amount</th>
                          <th className="text-left p-3 font-medium">Available to Take</th>
                          <th className="text-left p-3 font-medium">Take %</th>
                          <th className="text-left p-3 font-medium">Take Amount</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {carryForwardRows.map((row, index) => {
                          const preview = carryForwardPreviews[index];
                          return (
                            <tr key={index} className="border-b border-border/20 align-top">
                              <td className="p-3 min-w-[160px]">
                                <select
                                  value={row.sourceRaBillId}
                                  onChange={(e) => updateCarryForwardRow(index, { sourceRaBillId: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-xs"
                                  title={`Previous bill selector for row ${index + 1}`}
                                  aria-label={`Previous bill selector for row ${index + 1}`}
                                >
                                  <option value="">Select bill</option>
                                  {carryForwardSourceOptions.map((entry) => (
                                    <option key={entry.raBill.id} value={entry.raBill.id}>{entry.raBill.billName}</option>
                                  ))}
                                </select>
                                {preview?.duplicateSelection ? <p className="mt-1 text-[11px] text-destructive">This source bill is already selected.</p> : null}
                              </td>
                              <td className="p-3 text-sm font-medium">{preview?.sourceOption ? money(preview.sourceOption.totalReceivedAmount) : "-"}</td>
                              <td className="p-3 text-sm font-medium">{preview?.sourceOption ? money(preview.sourceOption.remainingAmount) : "-"}</td>
                              <td className="p-3 text-sm font-medium">{preview?.sourceOption ? money(preview.availableAmount) : "-"}</td>
                              <td className="p-3 w-32">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={row.percentage}
                                    onChange={(e) => updateCarryForwardRow(index, { percentage: e.target.value })}
                                    className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                                    placeholder="e.g. 50"
                                  />
                                  <span className="text-xs">%</span>
                                </div>
                              </td>
                              <td className="p-3 w-40">
                                <input
                                  type="number"
                                  min="0"
                                  max={preview?.availableAmount ?? undefined}
                                  step="0.01"
                                  value={row.amount}
                                  onChange={(e) => updateCarryForwardRow(index, { amount: e.target.value })}
                                  className={`w-full px-3 py-2 rounded-xl bg-secondary/50 border ${preview?.exceedsAvailable ? "border-destructive text-destructive" : "border-border/50"}`}
                                  placeholder="Amount"
                                />
                                {preview?.exceedsAvailable ? <p className="mt-1 text-[11px] text-destructive">Cannot exceed {money(preview.availableAmount)}.</p> : null}
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => removeCarryForwardRow(index)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                                  title="Remove previous bill"
                                  aria-label="Remove previous bill"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-secondary/20 font-semibold text-sm">
                          <td className="p-3" colSpan={5}>Carry Forward Total</td>
                          <td className="p-3">{money(totalCarryForwardAmount)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mt-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <DetailTile label="Tender Item Total" value={money(billTotals.total)} />
                  <DetailTile label="Carry Forward Added" value={money(totalCarryForwardAmount)} />
                  <DetailTile label="Grand Bill Total" value={money(round2(billTotals.total + totalCarryForwardAmount))} />
                  <DetailTile label="Bill Type" value={billPlanningType === "EXCESS" ? "Excess" : "Normal"} />
                </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button type="button" onClick={addBillItemRow} className="px-4 py-2 rounded-xl border border-border/50 text-sm hover:bg-secondary/40">
                  + Add Item
                </button>
                <button
                  onClick={() => createRaBillMutation.mutate()}
                  disabled={createRaBillMutation.isPending || hasInvalidBillRows || hasInvalidCarryForwardRows || billItemRows.some((row) => !row.itemId || !row.billPercentage || Number(row.billPercentage) <= 0)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  {createRaBillMutation.isPending ? "Creating..." : billPlanningType === "EXCESS" ? "Create Excess Bill" : "Create RA Bill"}
                </button>
              </div>
            </FinancialModal>
          )}

          {/* Deduction Popup */}
          {deductionPopup && deductionAmounts && (
            <FinancialModal title="Mark as Received - Enter Deductions" onClose={() => setDeductionPopup(null)}>
              <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm font-medium">Total Bill Amount: <span className="text-primary">{money(deductionPopup.totalAmount)}</span></p>
                <p className="text-xs text-muted-foreground mt-1">All 6 deductions below are calculated as a percentage of the total bill amount shown above, not from the received amount.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <DeductionField
                  label="Received Amount"
                  value={deductionState.chequeRtgsAmount}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, chequeRtgsAmount: v }))}
                  helperText={`${formatPercentage(deductionAmounts.receivedPercentage)} settled after adding deductions`}
                  isAmount
                />
                <DeductionField
                  label="10% IT"
                  value={deductionState.itDeductionPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, itDeductionPct: v }))}
                  computedAmount={deductionAmounts.itAmt}
                />
                <DeductionField
                  label="1% L.Cess"
                  value={deductionState.lCessDeductionPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, lCessDeductionPct: v }))}
                  computedAmount={deductionAmounts.lcessAmt}
                />
                <DeductionField
                  label="Security Deposit"
                  value={deductionState.securityDepositPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, securityDepositPct: v }))}
                  computedAmount={deductionAmounts.sdAmt}
                />
                <DeductionField
                  label="Recover From RA Bill"
                  value={deductionState.recoverFromRaBillPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, recoverFromRaBillPct: v }))}
                  computedAmount={deductionAmounts.recoverAmt}
                />
                <DeductionField
                  label="2% GST Withheld"
                  value={deductionState.gstWithheldPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, gstWithheldPct: v }))}
                  computedAmount={deductionAmounts.gstwAmt}
                />
                <DeductionField
                  label="Withheld Amount"
                  value={deductionState.withheldPct}
                  onChange={(v) => setDeductionState((prev) => ({ ...prev, withheldPct: v }))}
                  computedAmount={deductionAmounts.whAmt}
                />
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Received Date</label>
                  <input
                    type="date"
                    value={deductionState.receivedDate}
                    onChange={(e) => setDeductionState((prev) => ({ ...prev, receivedDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
                    title="Received date"
                    aria-label="Received date"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">Remark (optional)</label>
                <input
                  type="text"
                  value={deductionState.remark}
                  onChange={(e) => setDeductionState((prev) => ({ ...prev, remark: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
                  placeholder="Add a remark..."
                  title="Remark"
                  aria-label="Remark"
                />
              </div>

              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-6">
                  <span className="text-muted-foreground">Total Bill Amount</span>
                  <span className="font-medium text-right">{money(deductionAmounts.totalBillAmount)}</span>
                  <span className="text-muted-foreground">Received Amount</span>
                  <span className="font-medium text-right">{money(deductionAmounts.receivedAmount)}</span>
                  <span className="text-muted-foreground">Total Deductions</span>
                  <span className="font-medium text-right">{money(deductionAmounts.totalDeductions)}</span>
                  <span className="text-muted-foreground">% Amount Received</span>
                  <span className="font-medium text-right">{formatPercentage(deductionAmounts.receivedPercentage)}</span>
                  <span className="font-semibold">Total Received Amount</span>
                  <span className={`font-bold text-right ${deductionAmounts.totalReceived >= 0 ? "text-accent" : "text-destructive"}`}>
                    {money(deductionAmounts.totalReceived)}
                  </span>
                  <span className="font-semibold">Remaining Amount</span>
                  <span className="font-bold text-right text-warning">{money(deductionAmounts.remainingAmount)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={submitDeductions}
                  disabled={updateRaBillMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20 disabled:opacity-50"
                >
                  {updateRaBillMutation.isPending ? "Saving..." : "Confirm Received"}
                </button>
              </div>
            </FinancialModal>
          )}

          {showCarryRecord && (
            <FinancialModal title="Carry Forward Record" onClose={() => setShowCarryRecord(false)}>
              <div className="space-y-6">
                <div className="rounded-xl border border-border/40 bg-secondary/10 p-4 text-sm text-muted-foreground">
                  Track bill received amount, deductions, remaining amount, and how remaining value moves into later bills.
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground">
                        <th className="text-left p-3 font-medium">Bill</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Total Bill</th>
                        <th className="text-left p-3 font-medium">Received Amount</th>
                        <th className="text-left p-3 font-medium">Deductions</th>
                        <th className="text-left p-3 font-medium">Total Received</th>
                        <th className="text-left p-3 font-medium">Received %</th>
                        <th className="text-left p-3 font-medium">Remaining</th>
                        <th className="text-left p-3 font-medium">Used in Later Bills</th>
                        <th className="text-left p-3 font-medium">Still Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raBills.map((raBill) => {
                        const metrics = getRaBillMetrics(raBill);
                        return (
                          <tr key={raBill.id} className="border-b border-border/20">
                            <td className="p-3 font-medium">{raBill.billName}</td>
                            <td className="p-3">{(raBill.planningType ?? "NORMAL") === "EXCESS" ? "Excess" : "Normal"}</td>
                            <td className="p-3">{money(raBill.totalAmount)}</td>
                            <td className="p-3">{money(raBill.chequeRtgsAmount)}</td>
                            <td className="p-3">{money(metrics.totalDeductions)}</td>
                            <td className="p-3">{money(metrics.totalReceivedAmount)}</td>
                            <td className="p-3">{formatPercentage(metrics.receivedPercentage)}</td>
                            <td className="p-3">{money(metrics.remainingAmount)}</td>
                            <td className="p-3">{money(metrics.usedInLaterBillsAmount)}</td>
                            <td className="p-3">{money(metrics.availableCarryForwardAmount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3">Carry Forward Movement</h4>
                  {carryForwardMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No carry forward movement recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr className="border-b border-border/40 text-muted-foreground">
                            <th className="text-left p-3 font-medium">From Bill</th>
                            <th className="text-left p-3 font-medium">To Bill</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-left p-3 font-medium">Amount Taken</th>
                          </tr>
                        </thead>
                        <tbody>
                          {carryForwardMovements.map((movement, index) => (
                            <tr key={`${movement.sourceBillName}-${movement.targetBillName}-${index}`} className="border-b border-border/20">
                              <td className="p-3 font-medium">{movement.sourceBillName}</td>
                              <td className="p-3 font-medium">{movement.targetBillName}</td>
                              <td className="p-3">{movement.planningType === "EXCESS" ? "Excess" : "Normal"}</td>
                              <td className="p-3">{money(movement.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </FinancialModal>
          )}
        </>
      )}
    </PageWrapper>
  );
}

function RaBillCard({ raBill, onStatusChange, onReceivedClick, onDownloadLogPdf, onDownloadProperPdf, isPending }: {
  raBill: FinancialRaBill;
  onStatusChange: (status: FinancialBillStatus) => void;
  onReceivedClick: () => void;
  onDownloadLogPdf: () => void;
  onDownloadProperPdf: () => void;
  isPending: boolean;
}) {
  const statusCfg = financialBillStatusConfig[raBill.status];
  const metrics = getRaBillMetrics(raBill);

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      {/* RA bill header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-primary">{raBill.billName}</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${(raBill.planningType ?? "NORMAL") === "EXCESS" ? "text-warning bg-warning/10" : "text-primary bg-primary/10"}`}>
            {(raBill.planningType ?? "NORMAL") === "EXCESS" ? "Excess" : "Normal"}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {raBill.status === "RECEIVED" && (
            <>
              <button
                onClick={onDownloadLogPdf}
                className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs font-medium hover:bg-accent/20"
              >
                Log Details PDF
              </button>
              <button
                onClick={onDownloadProperPdf}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20"
              >
                Proper Bill PDF
              </button>
            </>
          )}
          {raBill.status !== "RECEIVED" && (
            <>
              {raBill.status === "PLANNING" && (
                <button
                  onClick={() => onStatusChange("PUT_UP")}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  Mark Put Up
                </button>
              )}
              <button
                onClick={onReceivedClick}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs font-medium hover:bg-accent/20 disabled:opacity-50"
              >
                Mark Received
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bill items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground text-xs">
              <th className="text-left px-4 py-2 font-medium">Item</th>
              <th className="text-left px-4 py-2 font-medium">Particulars</th>
              <th className="text-right px-4 py-2 font-medium">Bill % of Item %</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-right px-4 py-2 font-medium">Tax (18%)</th>
              <th className="text-right px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {raBill.items.map((billItem) => (
              <tr key={billItem.id} className="border-b border-border/20">
                <td className="px-4 py-2 font-medium text-xs">Item {billItem.item?.itemNumber}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] leading-5">
                  {billItem.item?.particulars.slice(0, 100)}{(billItem.item?.particulars.length ?? 0) > 100 ? "..." : ""}
                </td>
                <td className="px-4 py-2 text-right text-xs">
                  {billItem.billPercentage.toFixed(2)}% of {billItem.item?.percentage.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-right font-medium">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(billItem.billAmount)}</td>
                <td className="px-4 py-2 text-right">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(billItem.taxAmount)}</td>
                <td className="px-4 py-2 text-right font-semibold">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(billItem.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary/30 font-semibold text-sm">
              <td className="px-4 py-2" colSpan={3}>Bill Total</td>
              <td className="px-4 py-2 text-right">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalBillAmount)}</td>
              <td className="px-4 py-2 text-right">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalTaxAmount)}</td>
              <td className="px-4 py-2 text-right text-primary">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalAmount)}</td>
            </tr>
            {raBill.status === "RECEIVED" && (
              <tr className="bg-accent/5 font-medium text-xs">
                <td className="px-4 py-2" colSpan={3}>Payment Summary</td>
                <td className="px-4 py-2 text-right text-destructive">-{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(getBillTotalDeductions(raBill))}</td>
                <td className="px-4 py-2 text-right">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.chequeRtgsAmount)}</td>
                <td className="px-4 py-2 text-right text-accent">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalReceivedAmount)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Received details (shown only when RECEIVED) */}
      {raBill.status === "RECEIVED" && (
        <div className="px-4 py-3 bg-accent/5 border-t border-accent/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <ReceiptTile label="Total Bill Amount" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalAmount)} />
          <ReceiptTile label="Received Date" value={shortDate(raBill.receivedDate)} />
          <ReceiptTile label="Received Amount" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.chequeRtgsAmount)} />
          <ReceiptTile label="10% IT" value={`${raBill.itDeductionPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.itDeductionAmount)}`} />
          <ReceiptTile label="1% L.Cess" value={`${raBill.lCessDeductionPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.lCessDeductionAmount)}`} />
          <ReceiptTile label="Security Deposit" value={`${raBill.securityDepositPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.securityDepositAmount)}`} />
          <ReceiptTile label="Recover From RA Bill" value={`${raBill.recoverFromRaBillPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.recoverFromRaBillAmount)}`} />
          <ReceiptTile label="2% GST Withheld" value={`${raBill.gstWithheldPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.gstWithheldAmount)}`} />
          <ReceiptTile label="Withheld" value={`${raBill.withheldPct.toFixed(2)}% -> ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.withheldAmount)}`} />
          <ReceiptTile label="Total Deductions" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(metrics.totalDeductions)} />
          <ReceiptTile label="Total Received" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(raBill.totalReceivedAmount)} accent />
          <ReceiptTile label="Received %" value={formatPercentage(metrics.receivedPercentage)} />
          <ReceiptTile label="Remaining Amount" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(metrics.remainingAmount)} />
          {raBill.remark ? <ReceiptTile label="Remark" value={raBill.remark} /> : null}
        </div>
      )}

      {raBill.incomingCarryForwards.length > 0 || raBill.outgoingCarryForwards.length > 0 ? (
        <div className="px-4 py-3 border-t border-border/20 bg-secondary/10 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Included From Previous Bills</p>
            {raBill.incomingCarryForwards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No previous bill amount included.</p>
            ) : (
              <div className="space-y-1.5">
                {raBill.incomingCarryForwards.map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <span className="font-medium">{entry.sourceRaBill?.billName ?? "Previous bill"}</span>: {money(entry.amount)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Used In Later Bills</p>
            {raBill.outgoingCarryForwards.length === 0 ? (
              <p className="text-xs text-muted-foreground">No remaining amount used in later bills yet.</p>
            ) : (
              <div className="space-y-1.5">
                {raBill.outgoingCarryForwards.map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <span className="font-medium">{entry.targetRaBill?.billName ?? "Next bill"}</span>: {money(entry.amount)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReceiptTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

function DeductionField({ label, value, onChange, computedAmount, helperText, isAmount }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  computedAmount?: number;
  helperText?: string;
  isAmount?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          max={isAmount ? undefined : 100}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          placeholder={isAmount ? "Amount" : "% e.g. 10"}
          title={label}
          aria-label={label}
        />
        {!isAmount && <span className="text-xs text-muted-foreground shrink-0">%</span>}
      </div>
      {computedAmount !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">= {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(computedAmount)}</p>
      )}
      {helperText ? <p className="text-xs text-muted-foreground mt-1">{helperText}</p> : null}
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function FinancialModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BillGroupSection({
  title,
  bills,
  onStatusChange,
  onReceivedClick,
  onDownloadLogPdf,
  onDownloadProperPdf,
  isPending
}: {
  title: string;
  bills: FinancialRaBill[];
  onStatusChange: (raBill: FinancialRaBill, status: FinancialBillStatus) => void;
  onReceivedClick: (raBill: FinancialRaBill) => void;
  onDownloadLogPdf: (raBill: FinancialRaBill) => void;
  onDownloadProperPdf: (raBill: FinancialRaBill) => void;
  isPending: boolean;
}) {
  if (bills.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">No bills in this category yet.</p>
      </div>
    );
  }

  const total = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/10 px-4 py-2.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{bills.length} bills • {money(total)}</p>
      </div>
      {bills.map((raBill) => (
        <RaBillCard
          key={raBill.id}
          raBill={raBill}
          onStatusChange={(newStatus) => onStatusChange(raBill, newStatus)}
          onReceivedClick={() => onReceivedClick(raBill)}
          onDownloadLogPdf={() => onDownloadLogPdf(raBill)}
          onDownloadProperPdf={() => onDownloadProperPdf(raBill)}
          isPending={isPending}
        />
      ))}
    </div>
  );
}


