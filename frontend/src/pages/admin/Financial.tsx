import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { financialBillStatusConfig, type FinancialBillStatus } from "@/lib/domain";
import { toast } from "sonner";
import { CheckCircle2, Landmark, Receipt, Save } from "lucide-react";

const ITEM_TEMPLATES = [
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

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminFinancial() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [planningDraft, setPlanningDraft] = useState<Record<number, string>>({});
  const [billSelection, setBillSelection] = useState<Record<string, { selected: boolean; status: FinancialBillStatus; remark: string }>>({});
  const [billEdits, setBillEdits] = useState<Record<string, { status: FinancialBillStatus; receivedAmount: string; receivedDate: string; remark: string }>>({});

  const { data: eligibleProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["financial-projects"],
    queryFn: () => api.getFinancialProjects()
  });

  useEffect(() => {
    if (!selectedProjectId && eligibleProjects.length > 0) {
      setSelectedProjectId(eligibleProjects[0].id);
    }
  }, [eligibleProjects, selectedProjectId]);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["financial-project", selectedProjectId],
    queryFn: () => api.getProjectFinancial(selectedProjectId),
    enabled: Boolean(selectedProjectId)
  });

  useEffect(() => {
    if (!detail) return;
    const nextDraft: Record<number, string> = {};
    const source = detail.plan?.items.length
      ? detail.plan.items.map((item) => ({ itemNumber: item.itemNumber, percentage: item.percentage }))
      : ITEM_TEMPLATES.map((item) => ({ itemNumber: item.itemNumber, percentage: 0 }));
    source.forEach((item) => {
      nextDraft[item.itemNumber] = String(item.percentage ?? 0);
    });
    setPlanningDraft(nextDraft);
  }, [detail?.plan?.updatedAt, detail?.project?.id]);

  useEffect(() => {
    if (!detail?.plan) {
      setBillSelection({});
      setBillEdits({});
      return;
    }

    const nextSelection: Record<string, { selected: boolean; status: FinancialBillStatus; remark: string }> = {};
    detail.plan.items.forEach((item) => {
      nextSelection[item.id] = { selected: false, status: "PLANNING", remark: "" };
    });
    setBillSelection(nextSelection);

    const nextBillEdits: Record<string, { status: FinancialBillStatus; receivedAmount: string; receivedDate: string; remark: string }> = {};
    detail.plan.bills.forEach((bill) => {
      nextBillEdits[bill.id] = {
        status: bill.status,
        receivedAmount: String(bill.receivedAmount ?? 0),
        receivedDate: bill.receivedDate ? bill.receivedDate.slice(0, 10) : "",
        remark: bill.remark ?? ""
      };
    });
    setBillEdits(nextBillEdits);
  }, [detail?.plan?.updatedAt, detail?.project?.id]);

  const totalPercentage = useMemo(
    () => ITEM_TEMPLATES.reduce((sum, item) => sum + Number(planningDraft[item.itemNumber] || 0), 0),
    [planningDraft]
  );

  const receivedByItem = useMemo(() => {
    const map = new Map<string, number>();
    detail?.plan?.bills.forEach((bill) => {
      map.set(bill.itemId, (map.get(bill.itemId) ?? 0) + Number(bill.receivedAmount ?? 0));
    });
    return map;
  }, [detail?.plan?.bills]);

  const totalReceived = useMemo(
    () => detail?.plan?.bills.reduce((sum, bill) => sum + Number(bill.receivedAmount ?? 0), 0) ?? 0,
    [detail?.plan?.bills]
  );

  const selectedBillsCount = useMemo(
    () => Object.values(billSelection).filter((entry) => entry.selected).length,
    [billSelection]
  );

  const savePlanMutation = useMutation({
    mutationFn: () =>
      api.upsertFinancialPlan(selectedProjectId, {
        items: ITEM_TEMPLATES.map((item) => ({
          itemNumber: item.itemNumber,
          particulars: item.particulars,
          percentage: Number(planningDraft[item.itemNumber] || 0)
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", selectedProjectId] });
      toast.success("Financial item planning saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save financial planning");
    }
  });

  const createBillsMutation = useMutation({
    mutationFn: () =>
      api.createFinancialBills(selectedProjectId, {
        bills: Object.entries(billSelection)
          .filter(([, value]) => value.selected)
          .map(([itemId, value]) => ({ itemId, status: value.status, remark: value.remark || null }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", selectedProjectId] });
      toast.success("Financial bill rows created");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create bill rows");
    }
  });

  const updateBillMutation = useMutation({
    mutationFn: (args: { billId: string; status: FinancialBillStatus; receivedAmount: string; receivedDate: string; remark: string }) =>
      api.updateFinancialBill(args.billId, {
        status: args.status,
        receivedAmount: Number(args.receivedAmount || 0),
        receivedDate: args.receivedDate || null,
        remark: args.remark || null
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", selectedProjectId] });
      toast.success(`Bill row ${variables.billId.slice(0, 6)} updated`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update bill row");
    }
  });

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Financial</h1>
        <p className="page-subtitle">Plan project financial items, create bill rows, and track received amount</p>
      </div>

      <div className="glass-panel p-4 mb-6">
        <label className="text-sm font-medium mb-2 block">Select Eligible Project</label>
        <select
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          className="w-full max-w-xl px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50"
          title="Select project for financial planning"
          aria-label="Select project for financial planning"
        >
          {loadingProjects ? <option>Loading projects...</option> : null}
          {!loadingProjects && eligibleProjects.length === 0 ? <option value="">No eligible projects</option> : null}
          {!loadingProjects && eligibleProjects.map((project) => (
            <option key={project.id} value={project.id}>{project.projectNumber} · {project.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-2">
          Only projects with assigned project number and completed project requisition form can use Financial.
        </p>
      </div>

      {!selectedProjectId || !detail ? (
        <div className="glass-panel p-8 text-sm text-muted-foreground">{loadingDetail ? "Loading financial details..." : "Select a project to continue."}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Contract Value" value={money(detail.project.contractValue)} icon={<Landmark className="h-5 w-5" />} />
            <StatCard title="Tax Amount" value={money(detail.project.taxAmount)} icon={<Receipt className="h-5 w-5" />} />
            <StatCard title="Total Amount" value={money(detail.project.totalAmount)} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard title="Pending Amount" value={money(detail.project.totalAmount - totalReceived)} icon={<Receipt className="h-5 w-5" />} />
          </div>

          <div className="glass-panel p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold">1. Item Planning</h2>
                <p className="text-sm text-muted-foreground">Set percentage for the 6 fixed financial items. Total must be 100%.</p>
              </div>
              <button
                onClick={() => savePlanMutation.mutate()}
                disabled={savePlanMutation.isPending || Math.abs(totalPercentage - 100) > 0.01}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savePlanMutation.isPending ? "Saving..." : "Save Planning"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="text-left p-3 font-medium">Sr. No.</th>
                    <th className="text-left p-3 font-medium">Particulars</th>
                    <th className="text-left p-3 font-medium">Percentage</th>
                    <th className="text-left p-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ITEM_TEMPLATES.map((item) => {
                    const percentage = Number(planningDraft[item.itemNumber] || 0);
                    const amount = (detail.project.totalAmount * percentage) / 100;
                    return (
                      <tr key={item.itemNumber} className="border-b border-border/20 align-top">
                        <td className="p-3 font-medium">{item.itemNumber}</td>
                        <td className="p-3 leading-6">{item.particulars}</td>
                        <td className="p-3 w-36">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={planningDraft[item.itemNumber] ?? "0"}
                              onChange={(event) => setPlanningDraft((prev) => ({ ...prev, [item.itemNumber]: event.target.value }))}
                              className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Percentage for item ${item.itemNumber}`}
                              aria-label={`Percentage for item ${item.itemNumber}`}
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td className="p-3 font-medium">{money(amount)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-secondary/20 font-medium">
                    <td className="p-3" colSpan={2}>Total</td>
                    <td className={`p-3 ${Math.abs(totalPercentage - 100) > 0.01 ? "text-destructive" : "text-accent"}`}>{totalPercentage.toFixed(2)}%</td>
                    <td className="p-3">{money(detail.project.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold">2. Bill Creation</h2>
                <p className="text-sm text-muted-foreground">Select planned items to create bill rows. Initial received percentage stays at 0 until bill update.</p>
              </div>
              <button
                onClick={() => createBillsMutation.mutate()}
                disabled={createBillsMutation.isPending || !detail.plan || selectedBillsCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" />
                {createBillsMutation.isPending ? "Creating..." : `Create Bill Rows (${selectedBillsCount})`}
              </button>
            </div>

            {!detail.plan ? (
              <p className="text-sm text-muted-foreground">Save item planning first to enable bill creation.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[980px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Select</th>
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Particulars</th>
                      <th className="text-left p-3 font-medium">Planned %</th>
                      <th className="text-left p-3 font-medium">Item Amount</th>
                      <th className="text-left p-3 font-medium">% Received</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.plan.items.map((item) => {
                      const receivedAmount = receivedByItem.get(item.id) ?? 0;
                      const receivedPct = item.amount > 0 ? (receivedAmount / item.amount) * 100 : 0;
                      const selection = billSelection[item.id] ?? { selected: false, status: "PLANNING" as FinancialBillStatus, remark: "" };
                      return (
                        <tr key={item.id} className="border-b border-border/20 align-top">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selection.selected}
                              onChange={(event) => setBillSelection((prev) => ({
                                ...prev,
                                [item.id]: { ...selection, selected: event.target.checked }
                              }))}
                              title={`Select item ${item.itemNumber}`}
                              aria-label={`Select item ${item.itemNumber}`}
                            />
                          </td>
                          <td className="p-3 font-medium">{item.itemNumber}</td>
                          <td className="p-3 leading-6">{item.particulars}</td>
                          <td className="p-3">{item.percentage.toFixed(2)}%</td>
                          <td className="p-3">{money(item.amount)}</td>
                          <td className="p-3">{receivedPct.toFixed(2)}%</td>
                          <td className="p-3">
                            <select
                              value={selection.status}
                              onChange={(event) => setBillSelection((prev) => ({
                                ...prev,
                                [item.id]: { ...selection, status: event.target.value as FinancialBillStatus }
                              }))}
                              className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Status for item ${item.itemNumber}`}
                              aria-label={`Status for item ${item.itemNumber}`}
                            >
                              {(Object.keys(financialBillStatusConfig) as FinancialBillStatus[]).map((status) => (
                                <option key={status} value={status}>{financialBillStatusConfig[status].label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold">3. Bill Log / Update</h2>
              <p className="text-sm text-muted-foreground">Update received amount on bill rows. Percentage is calculated automatically from item amount.</p>
            </div>

            {!detail.plan || detail.plan.bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bill rows created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1280px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Particulars</th>
                      <th className="text-left p-3 font-medium">Planned Amount</th>
                      <th className="text-left p-3 font-medium">Received Amount</th>
                      <th className="text-left p-3 font-medium">% Received</th>
                      <th className="text-left p-3 font-medium">Remaining</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Received Date</th>
                      <th className="text-left p-3 font-medium">Remark</th>
                      <th className="text-left p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.plan.bills.map((bill) => {
                      const edit = billEdits[bill.id] ?? {
                        status: bill.status,
                        receivedAmount: String(bill.receivedAmount ?? 0),
                        receivedDate: bill.receivedDate ? bill.receivedDate.slice(0, 10) : "",
                        remark: bill.remark ?? ""
                      };
                      const receivedAmount = Number(edit.receivedAmount || 0);
                      const percent = bill.item && bill.item.amount > 0 ? (receivedAmount / bill.item.amount) * 100 : 0;
                      const remaining = Math.max(0, Number(bill.item?.amount ?? 0) - receivedAmount);
                      return (
                        <tr key={bill.id} className="border-b border-border/20 align-top">
                          <td className="p-3">{shortDate(bill.createdAt)}</td>
                          <td className="p-3 font-medium">{bill.item?.itemNumber ?? "-"}</td>
                          <td className="p-3 leading-6">{bill.item?.particulars ?? "-"}</td>
                          <td className="p-3">{money(Number(bill.item?.amount ?? 0))}</td>
                          <td className="p-3 w-40">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.receivedAmount}
                              onChange={(event) => setBillEdits((prev) => ({ ...prev, [bill.id]: { ...edit, receivedAmount: event.target.value } }))}
                              className="w-32 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Received amount for bill ${bill.id}`}
                              aria-label={`Received amount for bill ${bill.id}`}
                            />
                          </td>
                          <td className="p-3">{percent.toFixed(2)}%</td>
                          <td className="p-3">{money(remaining)}</td>
                          <td className="p-3">
                            <select
                              value={edit.status}
                              onChange={(event) => setBillEdits((prev) => ({ ...prev, [bill.id]: { ...edit, status: event.target.value as FinancialBillStatus } }))}
                              className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Status for bill ${bill.id}`}
                              aria-label={`Status for bill ${bill.id}`}
                            >
                              {(Object.keys(financialBillStatusConfig) as FinancialBillStatus[]).map((status) => (
                                <option key={status} value={status}>{financialBillStatusConfig[status].label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <input
                              type="date"
                              value={edit.receivedDate}
                              onChange={(event) => setBillEdits((prev) => ({ ...prev, [bill.id]: { ...edit, receivedDate: event.target.value } }))}
                              className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Received date for bill ${bill.id}`}
                              aria-label={`Received date for bill ${bill.id}`}
                            />
                          </td>
                          <td className="p-3 w-64">
                            <input
                              type="text"
                              value={edit.remark}
                              onChange={(event) => setBillEdits((prev) => ({ ...prev, [bill.id]: { ...edit, remark: event.target.value } }))}
                              className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Remark for bill ${bill.id}`}
                              aria-label={`Remark for bill ${bill.id}`}
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => updateBillMutation.mutate({
                                billId: bill.id,
                                status: edit.status,
                                receivedAmount: edit.receivedAmount,
                                receivedDate: edit.receivedDate,
                                remark: edit.remark
                              })}
                              disabled={updateBillMutation.isPending}
                              className="px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                            >
                              Update
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </PageWrapper>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="kpi-card">
      <div className="p-2.5 rounded-xl bg-primary/10 w-fit mb-3 text-primary">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}
