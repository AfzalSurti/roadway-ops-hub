import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinancialPlan, FinancialProfession } from "@/lib/domain";
import { DetailTile, FinancialModal } from "@/pages/admin/Financial";
import { ChevronDown, ChevronRight, Pencil, Save, Users } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

/** Net contract amount after this person's deduction % is taken off the gross (rate x MM). */
function netContractAmount(rate: number, contractMm: number, deductionPct: number) {
  return round2(rate * contractMm * (1 - (deductionPct || 0) / 100));
}

type ProfessionFormRow = {
  category: string;
  categoryOther: boolean;
  position: string;
  positionOther: boolean;
  personName: string;
  rate: string;
  mmConstruction: string;
  mmMaintenance: string;
  deductionPct: string;
};

const emptyProfessionForm: ProfessionFormRow = {
  category: "",
  categoryOther: false,
  position: "",
  positionOther: false,
  personName: "",
  rate: "",
  mmConstruction: "0",
  mmMaintenance: "0",
  deductionPct: "0"
};

const inputClass = "w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50";

function CategoryPicker({
  value,
  isOther,
  categories,
  onChange,
  className
}: {
  value: string;
  isOther: boolean;
  categories: string[];
  onChange: (patch: Partial<ProfessionFormRow>) => void;
  className?: string;
}) {
  if (isOther) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange({ category: e.target.value })}
          className={className}
          placeholder="Enter category"
        />
        <button
          type="button"
          onClick={() => onChange({ category: "", categoryOther: false, position: "", positionOther: false })}
          className="text-[10px] text-muted-foreground shrink-0 hover:text-foreground"
        >
          List
        </button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__other__") {
          onChange({ category: "", categoryOther: true, position: "", positionOther: true });
        } else {
          onChange({ category: e.target.value, categoryOther: false, position: "", positionOther: false });
        }
      }}
      className={className}
    >
      <option value="">Select category</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value="__other__">Other (type custom)</option>
    </select>
  );
}

function PositionPicker({
  category,
  value,
  isOther,
  positions,
  onChange,
  className
}: {
  category: string;
  value: string;
  isOther: boolean;
  positions: string[];
  onChange: (patch: Partial<ProfessionFormRow>) => void;
  className?: string;
}) {
  if (!category || isOther) {
    return (
      <div className="flex items-center gap-1">
        <textarea
          value={value}
          onChange={(e) => onChange({ position: e.target.value, positionOther: true })}
          rows={2}
          className={`${className} resize-y`}
          placeholder={category ? "Enter position" : "Select category first"}
          disabled={!category}
        />
        {category && positions.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ position: "", positionOther: false })}
            className="text-[10px] text-muted-foreground shrink-0 hover:text-foreground"
          >
            List
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__other__") onChange({ position: "", positionOther: true });
        else onChange({ position: e.target.value, positionOther: false });
      }}
      className={className}
    >
      <option value="">Select position</option>
      {positions.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value="__other__">Other (type custom)</option>
    </select>
  );
}

type ProfessionMetrics = {
  profession: FinancialProfession;
  contractMm: number;
  grossContractAmount: number;
  contractAmount: number;
  cumulativeMm: number;
  cumulativeAmount: number;
  latestMm: number;
  latestAmount: number;
  previousMm: number;
  previousAmount: number;
  balanceMm: number;
  balanceAmount: number;
};

export function ProfessionalStaffSection({
  projectId,
  plan,
  showAddProfession,
  onCloseAddProfession,
  showCreateBill,
  onCloseCreateBill
}: {
  projectId: string;
  plan: FinancialPlan;
  showAddProfession: boolean;
  onCloseAddProfession: () => void;
  showCreateBill: boolean;
  onCloseCreateBill: () => void;
}) {
  const queryClient = useQueryClient();
  const [professionRows, setProfessionRows] = useState<ProfessionFormRow[]>([emptyProfessionForm]);
  const [billingMonth, setBillingMonth] = useState("");
  const [billRemark, setBillRemark] = useState("");
  const [billMmInputs, setBillMmInputs] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingProfession, setEditingProfession] = useState<FinancialProfession | null>(null);
  const [editForm, setEditForm] = useState<ProfessionFormRow>(emptyProfessionForm);

  const { data: professionOptions } = useQuery({
    queryKey: ["financial-profession-options"],
    queryFn: () => api.getFinancialProfessionOptions(),
    staleTime: 60_000
  });
  const categories = professionOptions?.categories ?? [];
  const positionsByCategory = professionOptions?.positionsByCategory ?? {};

  const professions = plan.professions ?? [];
  const professionalBills = useMemo(
    () => [...(plan.professionalBills ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [plan.professionalBills]
  );
  const latestBill = professionalBills[professionalBills.length - 1];

  const metrics = useMemo<ProfessionMetrics[]>(() => {
    return professions.map((profession) => {
      const contractMm = round2(profession.mmConstruction + profession.mmMaintenance);
      const grossContractAmount = round2(profession.rate * contractMm);
      const contractAmount = netContractAmount(profession.rate, contractMm, profession.deductionPct);
      let cumulativeMm = 0;
      let cumulativeAmount = 0;
      for (const bill of professionalBills) {
        const item = bill.items.find((i) => i.professionId === profession.id);
        if (item) {
          cumulativeMm = round2(cumulativeMm + item.currentMm);
          cumulativeAmount = round2(cumulativeAmount + item.currentAmount);
        }
      }
      const latestItem = latestBill?.items.find((i) => i.professionId === profession.id);
      const latestMm = latestItem ? round2(latestItem.currentMm) : 0;
      const latestAmount = latestItem ? round2(latestItem.currentAmount) : 0;
      const previousMm = round2(cumulativeMm - latestMm);
      const previousAmount = round2(cumulativeAmount - latestAmount);
      const balanceMm = round2(Math.max(contractMm - cumulativeMm, 0));
      const balanceAmount = round2(Math.max(contractAmount - cumulativeAmount, 0));
      return {
        profession,
        contractMm,
        grossContractAmount,
        contractAmount,
        cumulativeMm,
        cumulativeAmount,
        latestMm,
        latestAmount,
        previousMm,
        previousAmount,
        balanceMm,
        balanceAmount
      };
    });
  }, [professions, professionalBills, latestBill]);

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const profession of professions) {
      if (!order.includes(profession.category)) order.push(profession.category);
    }
    return order.map((category) => ({
      category,
      rows: metrics.filter((m) => m.profession.category === category)
    }));
  }, [professions, metrics]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  useEffect(() => {
    if (showAddProfession) setProfessionRows([emptyProfessionForm]);
  }, [showAddProfession]);

  const validProfessionRows = professionRows.filter((row) => row.position.trim() && Number(row.rate) > 0);

  const addProfessionMutation = useMutation({
    mutationFn: () =>
      api.addFinancialProfessions(projectId, {
        items: validProfessionRows.map((row) => ({
          category: row.category.trim() || "Uncategorized",
          position: row.position.trim(),
          personName: row.personName.trim() || undefined,
          rate: Number(row.rate || 0),
          mmConstruction: Number(row.mmConstruction || 0),
          mmMaintenance: Number(row.mmMaintenance || 0),
          deductionPct: Number(row.deductionPct || 0)
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["financial-profession-options"] });
      onCloseAddProfession();
      setProfessionRows([emptyProfessionForm]);
      toast.success(validProfessionRows.length > 1 ? "Professions added" : "Profession added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add profession(s)")
  });

  function addProfessionRow() {
    setProfessionRows((prev) => [...prev, emptyProfessionForm]);
  }

  function removeProfessionRow(index: number) {
    setProfessionRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProfessionRow(index: number, patch: Partial<ProfessionFormRow>) {
    setProfessionRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const professionRowsTotalAmount = round2(
    professionRows.reduce(
      (sum, row) =>
        sum +
        netContractAmount(
          Number(row.rate || 0),
          Number(row.mmConstruction || 0) + Number(row.mmMaintenance || 0),
          Number(row.deductionPct || 0)
        ),
      0
    )
  );

  const updateProfessionMutation = useMutation({
    mutationFn: () => {
      if (!editingProfession) throw new Error("No profession selected");
      return api.updateFinancialProfession(editingProfession.id, {
        category: editForm.category.trim() || "Uncategorized",
        position: editForm.position.trim(),
        personName: editForm.personName.trim(),
        rate: Number(editForm.rate || 0),
        mmConstruction: Number(editForm.mmConstruction || 0),
        mmMaintenance: Number(editForm.mmMaintenance || 0),
        deductionPct: Number(editForm.deductionPct || 0)
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["financial-profession-options"] });
      setEditingProfession(null);
      toast.success("Profession updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update profession")
  });

  function openEditProfession(profession: FinancialProfession) {
    setEditingProfession(profession);
    setEditForm({
      category: profession.category,
      categoryOther: !categories.includes(profession.category),
      position: profession.position,
      positionOther: !(positionsByCategory[profession.category] ?? []).includes(profession.position),
      personName: profession.personName,
      rate: String(profession.rate),
      mmConstruction: String(profession.mmConstruction),
      mmMaintenance: String(profession.mmMaintenance),
      deductionPct: String(profession.deductionPct)
    });
  }

  const createBillMutation = useMutation({
    mutationFn: () =>
      api.createProfessionalBill(projectId, {
        billingMonth: billingMonth.trim() || undefined,
        remark: billRemark.trim() || undefined,
        items: Object.entries(billMmInputs)
          .filter(([, value]) => Number(value) > 0)
          .map(([professionId, value]) => ({ professionId, currentMm: Number(value) }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", projectId] });
      onCloseCreateBill();
      setBillMmInputs({});
      setBillingMonth("");
      setBillRemark("");
      toast.success("Professional bill created");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create professional bill")
  });

  const billTotalAmount = round2(
    Object.entries(billMmInputs).reduce((sum, [professionId, value]) => {
      const profession = professions.find((p) => p.id === professionId);
      if (!profession) return sum;
      return sum + profession.rate * Number(value || 0);
    }, 0)
  );

  return (
    <>
      <div className="glass-panel p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold inline-flex items-center gap-2">
            <Users className="h-4 w-4" /> Professional Staff
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Person-month staff billing (rate × MM) — for consultancy-style invoices, alongside the item-based RA
            bills above. Click a category to see the full breakdown.
          </p>
        </div>

        {professions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No professions added yet. Click "Add Profession" to begin.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const expanded = expandedCategories.has(group.category);
              const totalContract = group.rows.reduce((s, r) => s + r.contractAmount, 0);
              const totalCumulative = group.rows.reduce((s, r) => s + r.cumulativeAmount, 0);
              const totalBalance = group.rows.reduce((s, r) => s + r.balanceAmount, 0);
              return (
                <div key={group.category} className="rounded-xl border border-border/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-secondary/20 hover:bg-secondary/30 text-left"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-sm">
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {group.category}
                      <span className="text-xs text-muted-foreground font-normal">({group.rows.length})</span>
                    </span>
                    <span className="text-xs text-muted-foreground flex flex-wrap gap-x-4">
                      <span>Contract: <span className="text-foreground font-medium">{money(totalContract)}</span></span>
                      <span>Billed: <span className="text-foreground font-medium">{money(totalCumulative)}</span></span>
                      <span>Balance: <span className="text-foreground font-medium">{money(totalBalance)}</span></span>
                    </span>
                  </button>
                  {expanded ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[1280px]">
                        <thead>
                          <tr className="border-b border-border/40 text-muted-foreground">
                            <th className="text-left p-2 font-medium">Position</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-right p-2 font-medium">Rate</th>
                            <th className="text-right p-2 font-medium">Contract MM</th>
                            <th className="text-right p-2 font-medium">Deduction %</th>
                            <th className="text-right p-2 font-medium">Contract Amount</th>
                            <th className="text-right p-2 font-medium">Prev. MM</th>
                            <th className="text-right p-2 font-medium">Prev. Amount</th>
                            <th className="text-right p-2 font-medium">Latest Invoice MM</th>
                            <th className="text-right p-2 font-medium">Latest Invoice Amount</th>
                            <th className="text-right p-2 font-medium">Cumulative MM</th>
                            <th className="text-right p-2 font-medium">Cumulative Amount</th>
                            <th className="text-right p-2 font-medium">Balance MM</th>
                            <th className="text-right p-2 font-medium">Balance Amount</th>
                            <th className="p-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.profession.id} className="border-b border-border/20">
                              <td className="p-2 max-w-[200px]">
                                <span className="line-clamp-2">{row.profession.position}</span>
                              </td>
                              <td className="p-2">{row.profession.personName || "—"}</td>
                              <td className="p-2 text-right tabular-nums">{money(row.profession.rate)}</td>
                              <td className="p-2 text-right tabular-nums">{row.contractMm.toFixed(2)}</td>
                              <td className="p-2 text-right tabular-nums">
                                {row.profession.deductionPct > 0 ? `${row.profession.deductionPct.toFixed(2)}%` : "—"}
                              </td>
                              <td className="p-2 text-right tabular-nums">{money(row.contractAmount)}</td>
                              <td className="p-2 text-right tabular-nums">{row.previousMm.toFixed(2)}</td>
                              <td className="p-2 text-right tabular-nums">{money(row.previousAmount)}</td>
                              <td className="p-2 text-right tabular-nums">{row.latestMm.toFixed(2)}</td>
                              <td className="p-2 text-right tabular-nums">{money(row.latestAmount)}</td>
                              <td className="p-2 text-right tabular-nums font-medium">{row.cumulativeMm.toFixed(2)}</td>
                              <td className="p-2 text-right tabular-nums font-medium">{money(row.cumulativeAmount)}</td>
                              <td className="p-2 text-right tabular-nums">{row.balanceMm.toFixed(2)}</td>
                              <td className="p-2 text-right tabular-nums">{money(row.balanceAmount)}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openEditProfession(row.profession)}
                                  className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                                  title="Edit"
                                  aria-label="Edit profession"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-secondary/20 font-medium">
                            <td className="p-2" colSpan={5}>
                              Sub Total
                            </td>
                            <td className="p-2 text-right tabular-nums">{money(totalContract)}</td>
                            <td className="p-2" colSpan={2}></td>
                            <td className="p-2 text-right tabular-nums">{group.rows.reduce((s, r) => s + r.latestMm, 0).toFixed(2)}</td>
                            <td className="p-2 text-right tabular-nums">{money(group.rows.reduce((s, r) => s + r.latestAmount, 0))}</td>
                            <td className="p-2" colSpan={2}></td>
                            <td className="p-2 text-right tabular-nums">{money(totalBalance)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {professionalBills.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {professionalBills.length} professional bill(s) raised so far — latest: {latestBill?.billName}
                {latestBill?.billingMonth ? ` (${latestBill.billingMonth})` : ""}.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {showAddProfession ? (
        <FinancialModal title="Add Profession" onClose={onCloseAddProfession}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
            <DetailTile label="People in this batch" value={String(validProfessionRows.length)} />
            <DetailTile
              label="Total Contract MM"
              value={professionRows.reduce((s, r) => s + Number(r.mmConstruction || 0) + Number(r.mmMaintenance || 0), 0).toFixed(2)}
            />
            <DetailTile label="Total Contract Amount" value={money(professionRowsTotalAmount)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1280px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left p-3 font-medium">Sr. No.</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Position</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Rate (₹/mo)</th>
                  <th className="text-left p-3 font-medium">MM Constr.</th>
                  <th className="text-left p-3 font-medium">MM Maint.</th>
                  <th className="text-left p-3 font-medium">Deduction %</th>
                  <th className="text-left p-3 font-medium">Contract Amount</th>
                </tr>
              </thead>
              <tbody>
                {professionRows.map((row, index) => {
                  const amount = netContractAmount(
                    Number(row.rate || 0),
                    Number(row.mmConstruction || 0) + Number(row.mmMaintenance || 0),
                    Number(row.deductionPct || 0)
                  );
                  return (
                    <tr key={index} className="border-b border-border/20 align-top">
                      <td className="p-3 font-medium w-16">{index + 1}</td>
                      <td className="p-3 w-40">
                        <CategoryPicker
                          value={row.category}
                          isOther={row.categoryOther}
                          categories={categories}
                          onChange={(patch) => updateProfessionRow(index, patch)}
                          className={`${inputClass} text-xs`}
                        />
                      </td>
                      <td className="p-3 min-w-[220px]">
                        <PositionPicker
                          category={row.category}
                          value={row.position}
                          isOther={row.positionOther}
                          positions={positionsByCategory[row.category] ?? []}
                          onChange={(patch) => updateProfessionRow(index, patch)}
                          className={`${inputClass} text-xs`}
                        />
                        <button
                          type="button"
                          onClick={() => removeProfessionRow(index)}
                          disabled={professionRows.length <= 1}
                          className="mt-2 text-xs text-destructive disabled:text-muted-foreground"
                        >
                          Remove
                        </button>
                      </td>
                      <td className="p-3 min-w-[160px]">
                        <input
                          value={row.personName}
                          onChange={(e) => updateProfessionRow(index, { personName: e.target.value })}
                          className={inputClass}
                          placeholder="e.g. Mr. Manish Kumar Jivani"
                        />
                      </td>
                      <td className="p-3 w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.rate}
                          onChange={(e) => updateProfessionRow(index, { rate: e.target.value })}
                          className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 w-24">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.mmConstruction}
                          onChange={(e) => updateProfessionRow(index, { mmConstruction: e.target.value })}
                          className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 w-24">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.mmMaintenance}
                          onChange={(e) => updateProfessionRow(index, { mmMaintenance: e.target.value })}
                          className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 w-24">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.deductionPct}
                          onChange={(e) => updateProfessionRow(index, { deductionPct: e.target.value })}
                          className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 font-medium">{money(amount)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/20 font-medium">
                  <td className="p-3" colSpan={8}>
                    Total
                  </td>
                  <td className="p-3">{money(professionRowsTotalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <button type="button" onClick={addProfessionRow} className="px-4 py-2 rounded-xl border border-border/50 text-sm hover:bg-secondary/40">
              Add Item
            </button>
            <button
              onClick={() => addProfessionMutation.mutate()}
              disabled={validProfessionRows.length === 0 || addProfessionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {addProfessionMutation.isPending ? "Saving..." : "Save Profession(s)"}
            </button>
          </div>
        </FinancialModal>
      ) : null}

      {showCreateBill ? (
        <FinancialModal title="Create Professional Bill" onClose={onCloseCreateBill}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Billing Month</label>
              <input
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                placeholder="e.g. August 2021"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Remark</label>
              <input value={billRemark} onChange={(e) => setBillRemark(e.target.value)} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Enter the person-months claimed this invoice for each profession. Leave at 0 for anyone not billed this round.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
            <DetailTile
              label="People Billed This Invoice"
              value={String(Object.values(billMmInputs).filter((v) => Number(v) > 0).length)}
            />
            <DetailTile
              label="Total MM This Invoice"
              value={Object.values(billMmInputs).reduce((sum, v) => sum + Number(v || 0), 0).toFixed(2)}
            />
            <DetailTile label="Total Amount This Invoice" value={money(billTotalAmount)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left p-3 font-medium">Position</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-right p-3 font-medium">Balance MM</th>
                  <th className="text-right p-3 font-medium">Current MM</th>
                  <th className="text-right p-3 font-medium">Current Amount</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.profession.id} className="border-b border-border/20">
                    <td className="p-3 max-w-[220px]">
                      <span className="line-clamp-2">{row.profession.position}</span>
                    </td>
                    <td className="p-3">{row.profession.personName || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{row.balanceMm.toFixed(2)}</td>
                    <td className="p-3 w-32">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={row.balanceMm}
                        value={billMmInputs[row.profession.id] ?? ""}
                        onChange={(e) => setBillMmInputs((prev) => ({ ...prev, [row.profession.id]: e.target.value }))}
                        className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {money(row.profession.rate * Number(billMmInputs[row.profession.id] || 0))}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditProfession(row.profession)}
                        className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        title="Edit"
                        aria-label="Edit profession"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-secondary/20 font-medium">
                  <td className="p-3" colSpan={4}>
                    Total
                  </td>
                  <td className="p-3 text-right tabular-nums">{money(billTotalAmount)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => createBillMutation.mutate()}
              disabled={createBillMutation.isPending || Object.values(billMmInputs).every((v) => !Number(v))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {createBillMutation.isPending ? "Saving..." : "Save Professional Bill"}
            </button>
          </div>
        </FinancialModal>
      ) : null}

      {editingProfession ? (
        <FinancialModal title="Edit Profession" onClose={() => setEditingProfession(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <CategoryPicker
                value={editForm.category}
                isOther={editForm.categoryOther}
                categories={categories}
                onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Position</label>
              <PositionPicker
                category={editForm.category}
                value={editForm.position}
                isOther={editForm.positionOther}
                positions={positionsByCategory[editForm.category] ?? []}
                onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <input
                value={editForm.personName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, personName: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rate (₹ / month)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.rate}
                onChange={(e) => setEditForm((prev) => ({ ...prev, rate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">MM in Construction Period</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.mmConstruction}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mmConstruction: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">MM in Maintenance Period</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.mmMaintenance}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mmMaintenance: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Deduction %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={editForm.deductionPct}
                onChange={(e) => setEditForm((prev) => ({ ...prev, deductionPct: e.target.value }))}
                className={inputClass}
              />
            </div>
            <DetailTile
              label="Net Contract Amount"
              value={money(
                netContractAmount(
                  Number(editForm.rate || 0),
                  Number(editForm.mmConstruction || 0) + Number(editForm.mmMaintenance || 0),
                  Number(editForm.deductionPct || 0)
                )
              )}
            />
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => updateProfessionMutation.mutate()}
              disabled={!editForm.position.trim() || !editForm.rate || updateProfessionMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateProfessionMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </FinancialModal>
      ) : null}
    </>
  );
}
