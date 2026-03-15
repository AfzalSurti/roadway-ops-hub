import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { financialBillStatusConfig, type FinancialBillStatus } from "@/lib/domain";
import { toast } from "sonner";
import { Receipt, Save, X } from "lucide-react";

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
  const [selectedItemInfo, setSelectedItemInfo] = useState<{ itemNumber: number; particulars: string } | null>(null);
  const [planningRows, setPlanningRows] = useState<Array<{ itemNumber: number; particulars: string; percentage: string }>>([]);
  const [showPlanning, setShowPlanning] = useState(false);
  const [showBillSelection, setShowBillSelection] = useState(false);
  const [billSelection, setBillSelection] = useState<Record<string, { selected: boolean; includePreviousRemaining: boolean }>>({});
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
    const source = detail.plan?.items.length
      ? detail.plan.items.map((item) => ({ itemNumber: item.itemNumber, particulars: item.particulars, percentage: String(item.percentage) }))
      : detail.itemTemplates.map((item) => ({ itemNumber: item.itemNumber, particulars: item.particulars, percentage: "0" }));
    setPlanningRows(source);
  }, [detail?.plan?.updatedAt, detail?.project?.id]);

  useEffect(() => {
    if (!detail?.plan) {
      setBillSelection({});
      setBillEdits({});
      return;
    }

    const nextSelection: Record<string, { selected: boolean; includePreviousRemaining: boolean }> = {};
    detail.plan.items.forEach((item) => {
      nextSelection[item.id] = { selected: false, includePreviousRemaining: false };
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
    () => planningRows.reduce((sum, item) => sum + Number(item.percentage || 0), 0),
    [planningRows]
  );

  const addPlanningRow = () => {
    const nextNumber = planningRows.length > 0 ? Math.max(...planningRows.map((row) => row.itemNumber)) + 1 : 1;
    setPlanningRows((prev) => [...prev, { itemNumber: nextNumber, particulars: "", percentage: "0" }]);
  };

  const removePlanningRow = (index: number) => {
    setPlanningRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updatePlanningRow = (index: number, patch: Partial<{ itemNumber: number; particulars: string; percentage: string }>) => {
    setPlanningRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

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
        items: planningRows.map((item) => ({
          itemNumber: Number(item.itemNumber),
          particulars: item.particulars.trim(),
          percentage: Number(item.percentage || 0)
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", selectedProjectId] });
      setShowPlanning(false);
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
          .map(([itemId, value]) => ({
            itemId,
            includePreviousRemaining: value.includePreviousRemaining,
            status: "PLANNING" as FinancialBillStatus
          }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", selectedProjectId] });
      setShowBillSelection(false);
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
          <div className="glass-panel p-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
                <DetailTile label="Project" value={`${detail.project.projectNumber} · ${detail.project.name}`} />
                <DetailTile label="Contract Value" value={money(detail.project.contractValue)} />
                <DetailTile label="Tax" value={money(detail.project.taxAmount)} />
                <DetailTile label="Total Amount" value={money(detail.project.totalAmount)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPlanning(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20"
                >
                  <Save className="h-4 w-4" />
                  Item Planning
                </button>
                <button
                  onClick={() => setShowBillSelection(true)}
                  disabled={!detail.plan}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  Bill Selection
                </button>
              </div>
            </div>
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
                      const plannedAmount = Number(bill.billAmount && bill.billAmount > 0 ? bill.billAmount : (bill.item?.amount ?? 0));
                      const percent = plannedAmount > 0 ? (receivedAmount / plannedAmount) * 100 : 0;
                      const remaining = Math.max(0, plannedAmount - receivedAmount);
                      return (
                        <tr key={bill.id} className="border-b border-border/20 align-top">
                          <td className="p-3">{shortDate(bill.createdAt)}</td>
                          <td className="p-3">
                            {bill.item?.itemNumber ? (
                              <button
                                type="button"
                                onClick={() => setSelectedItemInfo({ itemNumber: bill.item!.itemNumber, particulars: bill.item!.particulars })}
                                className="px-2.5 py-1 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10"
                                title="View item details"
                              >
                                Item {bill.item.itemNumber}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">{money(plannedAmount)}</td>
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

          {showPlanning && (
            <FinancialModal title="Item Planning" onClose={() => setShowPlanning(false)}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                <DetailTile label="Contract Value" value={money(detail.project.contractValue)} />
                <DetailTile label="Tax" value={money(detail.project.taxAmount)} />
                <DetailTile label="Total Amount" value={money(detail.project.totalAmount)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-3 font-medium">Sr. No.</th>
                      <th className="text-left p-3 font-medium">Particulars</th>
                      <th className="text-left p-3 font-medium">Percentage</th>
                      <th className="text-left p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Tax (18%)</th>
                      <th className="text-left p-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningRows.map((item, index) => {
                      const percentage = Number(item.percentage || 0);
                      const amount = (detail.project.contractValue * percentage) / 100;
                      const tax = amount * 0.18;
                      const total = amount + tax;
                      return (
                        <tr key={`${item.itemNumber}-${index}`} className="border-b border-border/20 align-top">
                          <td className="p-3 font-medium w-28">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.itemNumber}
                              onChange={(event) => updatePlanningRow(index, { itemNumber: Number(event.target.value || 0) })}
                              className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                              title={`Item number row ${index + 1}`}
                              aria-label={`Item number row ${index + 1}`}
                            />
                          </td>
                          <td className="p-3 leading-6">
                            <textarea
                              value={item.particulars}
                              onChange={(event) => updatePlanningRow(index, { particulars: event.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 resize-y"
                              title={`Particulars row ${index + 1}`}
                              aria-label={`Particulars row ${index + 1}`}
                            />
                          </td>
                          <td className="p-3 w-36">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.percentage}
                                onChange={(event) => updatePlanningRow(index, { percentage: event.target.value })}
                                className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                                title={`Percentage for item ${item.itemNumber}`}
                                aria-label={`Percentage for item ${item.itemNumber}`}
                              />
                              <span>%</span>
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
                      <td className={`p-3 ${Math.abs(totalPercentage - 100) > 0.01 ? "text-destructive" : "text-accent"}`}>{totalPercentage.toFixed(2)}%</td>
                      <td className="p-3">{money(detail.project.contractValue)}</td>
                      <td className="p-3">{money(detail.project.taxAmount)}</td>
                      <td className="p-3">{money(detail.project.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={addPlanningRow}
                  className="px-4 py-2 rounded-xl border border-border/50 text-sm hover:bg-secondary/40"
                >
                  Add Item
                </button>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => savePlanMutation.mutate()}
                  disabled={savePlanMutation.isPending || planningRows.some((row) => !row.particulars.trim() || row.itemNumber < 1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savePlanMutation.isPending ? "Saving..." : "Save Planning"}
                </button>
              </div>
            </FinancialModal>
          )}

          {showBillSelection && (
            <FinancialModal title="Bill Selection" onClose={() => setShowBillSelection(false)}>
              {!detail.plan ? (
                <p className="text-sm text-muted-foreground">Save item planning first to enable bill selection.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead>
                        <tr className="border-b border-border/40 text-muted-foreground">
                          <th className="text-left p-3 font-medium">Select</th>
                          <th className="text-left p-3 font-medium">Item</th>
                          <th className="text-left p-3 font-medium">Particulars</th>
                          <th className="text-left p-3 font-medium">Planned %</th>
                          <th className="text-left p-3 font-medium">Item Amount</th>
                          <th className="text-left p-3 font-medium">% Received</th>
                          <th className="text-left p-3 font-medium">Previous Bill Remaining</th>
                          <th className="text-left p-3 font-medium">Carry Forward?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.plan.items.map((item) => {
                          const receivedAmount = receivedByItem.get(item.id) ?? 0;
                          const receivedPct = item.amount > 0 ? (receivedAmount / item.amount) * 100 : 0;
                          const selection = billSelection[item.id] ?? { selected: false, includePreviousRemaining: false };
                          const previousBills = detail.plan?.bills.filter((bill) => bill.itemId === item.id) ?? [];
                          const latestBill = previousBills.length > 0 ? previousBills[0] : null;
                          const previousRemaining = latestBill ? Math.max(0, Number(latestBill.billAmount ?? item.amount) - Number(latestBill.receivedAmount ?? 0)) : 0;
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
                              <td className="p-3">{money(previousRemaining)}</td>
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={selection.includePreviousRemaining}
                                  disabled={previousRemaining <= 0}
                                  onChange={(event) => {
                                    if (event.target.checked) {
                                      const confirmed = window.confirm("Do you want to add remaining amount of previous bill in this new bill?");
                                      if (!confirmed) {
                                        return;
                                      }
                                    }
                                    setBillSelection((prev) => ({
                                      ...prev,
                                      [item.id]: { ...selection, includePreviousRemaining: event.target.checked }
                                    }));
                                  }}
                                  title={`Include previous remaining for item ${item.itemNumber}`}
                                  aria-label={`Include previous remaining for item ${item.itemNumber}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => createBillsMutation.mutate()}
                      disabled={createBillsMutation.isPending || selectedBillsCount === 0}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                    >
                      <Receipt className="h-4 w-4" />
                      {createBillsMutation.isPending ? "Creating..." : `Create Bill (${selectedBillsCount})`}
                    </button>
                  </div>
                </>
              )}
            </FinancialModal>
          )}

          {selectedItemInfo && (
            <FinancialModal title={`Item ${selectedItemInfo.itemNumber} Details`} onClose={() => setSelectedItemInfo(null)}>
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-sm leading-7">{selectedItemInfo.particulars}</p>
              </div>
            </FinancialModal>
          )}
        </>
      )}
    </PageWrapper>
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
      <div onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-6xl mx-4 max-h-[88vh] overflow-y-auto">
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
