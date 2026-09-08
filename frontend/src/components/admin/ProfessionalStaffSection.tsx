import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinancialPlan, FinancialProfession, FinancialProfessionCategory } from "@/lib/domain";
import { DetailTile, FinancialModal } from "@/pages/admin/Financial";
import { Save, Users } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

type NewProfessionForm = {
  category: FinancialProfessionCategory;
  position: string;
  personName: string;
  rate: string;
  mmConstruction: string;
  mmMaintenance: string;
};

const emptyProfessionForm: NewProfessionForm = {
  category: "KEY",
  position: "",
  personName: "",
  rate: "",
  mmConstruction: "0",
  mmMaintenance: "0"
};

type ProfessionMetrics = {
  profession: FinancialProfession;
  contractMm: number;
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
  const [professionRows, setProfessionRows] = useState<NewProfessionForm[]>([emptyProfessionForm]);
  const [billingMonth, setBillingMonth] = useState("");
  const [billRemark, setBillRemark] = useState("");
  const [billMmInputs, setBillMmInputs] = useState<Record<string, string>>({});

  const professions = plan.professions ?? [];
  const professionalBills = useMemo(
    () => [...(plan.professionalBills ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [plan.professionalBills]
  );
  const latestBill = professionalBills[professionalBills.length - 1];

  const metrics = useMemo<ProfessionMetrics[]>(() => {
    return professions.map((profession) => {
      const contractMm = round2(profession.mmConstruction + profession.mmMaintenance);
      const contractAmount = round2(profession.rate * contractMm);
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

  const groups: Array<{ label: string; rows: ProfessionMetrics[] }> = [
    { label: "Key Professional Staff", rows: metrics.filter((m) => m.profession.category === "KEY") },
    { label: "Sub-Professional Staff", rows: metrics.filter((m) => m.profession.category === "SUB") }
  ];

  useEffect(() => {
    if (showAddProfession) setProfessionRows([emptyProfessionForm]);
  }, [showAddProfession]);

  const validProfessionRows = professionRows.filter((row) => row.position.trim() && Number(row.rate) > 0);

  const addProfessionMutation = useMutation({
    mutationFn: () =>
      api.addFinancialProfessions(projectId, {
        items: validProfessionRows.map((row) => ({
          category: row.category,
          position: row.position.trim(),
          personName: row.personName.trim() || undefined,
          rate: Number(row.rate || 0),
          mmConstruction: Number(row.mmConstruction || 0),
          mmMaintenance: Number(row.mmMaintenance || 0)
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["financial-project", projectId] });
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

  function updateProfessionRow(index: number, patch: Partial<NewProfessionForm>) {
    setProfessionRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const professionRowsTotalAmount = round2(
    professionRows.reduce((sum, row) => sum + Number(row.rate || 0) * (Number(row.mmConstruction || 0) + Number(row.mmMaintenance || 0)), 0)
  );

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
          Person-month staff billing (Key/Sub-professional staff, rate × MM) — for consultancy-style invoices,
          alongside the item-based RA bills above.
        </p>
      </div>

      {professions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No professions added yet. Click "Add Profession" to begin.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) =>
            group.rows.length === 0 ? null : (
              <div key={group.label} className="overflow-x-auto">
                <p className="text-sm font-medium mb-2">{group.label}</p>
                <table className="w-full text-xs min-w-[1200px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="text-left p-2 font-medium">Position</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-right p-2 font-medium">Rate</th>
                      <th className="text-right p-2 font-medium">Contract MM</th>
                      <th className="text-right p-2 font-medium">Contract Amount</th>
                      <th className="text-right p-2 font-medium">Prev. MM</th>
                      <th className="text-right p-2 font-medium">Prev. Amount</th>
                      <th className="text-right p-2 font-medium">Latest Invoice MM</th>
                      <th className="text-right p-2 font-medium">Latest Invoice Amount</th>
                      <th className="text-right p-2 font-medium">Cumulative MM</th>
                      <th className="text-right p-2 font-medium">Cumulative Amount</th>
                      <th className="text-right p-2 font-medium">Balance MM</th>
                      <th className="text-right p-2 font-medium">Balance Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.profession.id} className="border-b border-border/20">
                        <td className="p-2 max-w-[200px]"><span className="line-clamp-2">{row.profession.position}</span></td>
                        <td className="p-2">{row.profession.personName || "—"}</td>
                        <td className="p-2 text-right tabular-nums">{money(row.profession.rate)}</td>
                        <td className="p-2 text-right tabular-nums">{row.contractMm.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">{money(row.contractAmount)}</td>
                        <td className="p-2 text-right tabular-nums">{row.previousMm.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">{money(row.previousAmount)}</td>
                        <td className="p-2 text-right tabular-nums">{row.latestMm.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">{money(row.latestAmount)}</td>
                        <td className="p-2 text-right tabular-nums font-medium">{row.cumulativeMm.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums font-medium">{money(row.cumulativeAmount)}</td>
                        <td className="p-2 text-right tabular-nums">{row.balanceMm.toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">{money(row.balanceAmount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-secondary/20 font-medium">
                      <td className="p-2" colSpan={4}>Sub Total</td>
                      <td className="p-2 text-right tabular-nums">{money(group.rows.reduce((s, r) => s + r.contractAmount, 0))}</td>
                      <td className="p-2" colSpan={2}></td>
                      <td className="p-2 text-right tabular-nums">{group.rows.reduce((s, r) => s + r.latestMm, 0).toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">{money(group.rows.reduce((s, r) => s + r.latestAmount, 0))}</td>
                      <td className="p-2" colSpan={2}></td>
                      <td className="p-2 text-right tabular-nums">{money(group.rows.reduce((s, r) => s + r.balanceAmount, 0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          )}
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
            <DetailTile label="Total Contract MM" value={professionRows.reduce((s, r) => s + Number(r.mmConstruction || 0) + Number(r.mmMaintenance || 0), 0).toFixed(2)} />
            <DetailTile label="Total Contract Amount" value={money(professionRowsTotalAmount)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1080px]">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="text-left p-3 font-medium">Sr. No.</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-left p-3 font-medium">Position</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Rate (₹/mo)</th>
                  <th className="text-left p-3 font-medium">MM Constr.</th>
                  <th className="text-left p-3 font-medium">MM Maint.</th>
                  <th className="text-left p-3 font-medium">Contract Amount</th>
                </tr>
              </thead>
              <tbody>
                {professionRows.map((row, index) => {
                  const amount = Number(row.rate || 0) * (Number(row.mmConstruction || 0) + Number(row.mmMaintenance || 0));
                  return (
                    <tr key={index} className="border-b border-border/20 align-top">
                      <td className="p-3 font-medium w-16">{index + 1}</td>
                      <td className="p-3 w-40">
                        <select
                          value={row.category}
                          onChange={(e) => updateProfessionRow(index, { category: e.target.value as FinancialProfessionCategory })}
                          className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-xs"
                        >
                          <option value="KEY">Key Staff</option>
                          <option value="SUB">Sub-Staff</option>
                        </select>
                      </td>
                      <td className="p-3 min-w-[220px]">
                        <textarea
                          value={row.position}
                          onChange={(e) => updateProfessionRow(index, { position: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 resize-y"
                          placeholder="e.g. Team Leader cum Senior Highway Engineer"
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
                          className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                          placeholder="e.g. Mr. Manish Kumar Jivani"
                        />
                      </td>
                      <td className="p-3 w-28">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.rate}
                          onChange={(e) => updateProfessionRow(index, { rate: e.target.value })}
                          className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 w-24">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.mmConstruction}
                          onChange={(e) => updateProfessionRow(index, { mmConstruction: e.target.value })}
                          className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 w-24">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.mmMaintenance}
                          onChange={(e) => updateProfessionRow(index, { mmMaintenance: e.target.value })}
                          className="w-20 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        />
                      </td>
                      <td className="p-3 font-medium">{money(amount)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-secondary/20 font-medium">
                  <td className="p-3" colSpan={7}>Total</td>
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
                className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Remark</label>
              <input
                value={billRemark}
                onChange={(e) => setBillRemark(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
              />
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
                </tr>
              </thead>
              <tbody>
                {metrics.map((row) => (
                  <tr key={row.profession.id} className="border-b border-border/20">
                    <td className="p-3 max-w-[220px]"><span className="line-clamp-2">{row.profession.position}</span></td>
                    <td className="p-3">{row.profession.personName || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{row.balanceMm.toFixed(2)}</td>
                    <td className="p-3 w-32">
                      <input
                        type="number" min="0" step="0.01" max={row.balanceMm}
                        value={billMmInputs[row.profession.id] ?? ""}
                        onChange={(e) => setBillMmInputs((prev) => ({ ...prev, [row.profession.id]: e.target.value }))}
                        className="w-24 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {money(row.profession.rate * Number(billMmInputs[row.profession.id] || 0))}
                    </td>
                  </tr>
                ))}
                <tr className="bg-secondary/20 font-medium">
                  <td className="p-3" colSpan={4}>Total</td>
                  <td className="p-3 text-right tabular-nums">{money(billTotalAmount)}</td>
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
    </>
  );
}
