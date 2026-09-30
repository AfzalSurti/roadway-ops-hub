import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectBillingEntry } from "@/lib/domain";
import { Landmark, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const inputClass = "w-full min-w-[90px] px-2 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-xs";

type NumericField =
  | "basicAmountClaimed"
  | "basicAmountPassed"
  | "gstAmount"
  | "totalAmount"
  | "tds"
  | "sdRetention"
  | "gstDeduction"
  | "amountToReceive"
  | "chequeAmount"
  | "amountHold"
  | "gstReceived";

const NUMERIC_COLUMNS: Array<{ key: NumericField; label: string }> = [
  { key: "basicAmountClaimed", label: "Basic Amount Claimed" },
  { key: "basicAmountPassed", label: "Basic Amount Passed by Client" },
  { key: "gstAmount", label: "18% GST" },
  { key: "totalAmount", label: "Total Amount" },
  { key: "tds", label: "TDS" },
  { key: "sdRetention", label: "SD / Retention Money" },
  { key: "gstDeduction", label: "GST" },
  { key: "amountToReceive", label: "Amount to be Received" },
  { key: "chequeAmount", label: "Chq. Amt" },
  { key: "amountHold", label: "Amt Hold" },
  { key: "gstReceived", label: "GST Received" }
];

export default function AccountsBillingLedger() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const { data: eligibleProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["billing-projects"],
    queryFn: () => api.getFinancialProjects(),
    staleTime: 5 * 60 * 1000
  });

  const activeProjectId = selectedProjectId || eligibleProjects[0]?.id || "";

  const { data: projectDetail } = useQuery({
    queryKey: ["billing-project-detail", activeProjectId],
    queryFn: () => api.getProjectFinancial(activeProjectId),
    enabled: Boolean(activeProjectId)
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["billing-entries", activeProjectId],
    queryFn: () => api.getProjectBillingEntries(activeProjectId),
    enabled: Boolean(activeProjectId)
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["billing-entries", activeProjectId] });

  const addMutation = useMutation({
    mutationFn: () => api.createProjectBillingEntry(activeProjectId, {}),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add bill")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProjectBillingEntry> }) =>
      api.updateProjectBillingEntry(id, payload),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProjectBillingEntry(id),
    onSuccess: async () => {
      toast.success("Bill deleted");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete")
  });

  const totals = useMemo(() => {
    const acc: Record<NumericField, number> = {
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
    };
    for (const entry of entries) {
      for (const col of NUMERIC_COLUMNS) acc[col.key] += Number(entry[col.key]) || 0;
    }
    return acc;
  }, [entries]);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title inline-flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Billing
        </h1>
        <p className="page-subtitle">Per-project RA bill ledger — date, claim, GST, and payment received breakdown.</p>
      </div>

      <div className="glass-panel p-4 mb-6">
        <label className="text-sm font-medium mb-2 block">Select Project</label>
        <select
          value={activeProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full max-w-xl px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50"
        >
          {loadingProjects ? <option>Loading projects...</option> : null}
          {!loadingProjects && eligibleProjects.length === 0 ? <option value="">No eligible projects</option> : null}
          {!loadingProjects &&
            eligibleProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} - {project.name}
              </option>
            ))}
        </select>
      </div>

      {!activeProjectId ? (
        <div className="glass-panel p-8 text-sm text-muted-foreground">Select a project to continue.</div>
      ) : (
        <div className="glass-panel p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Work Order</p>
              <p className="font-medium">{projectDetail?.project.workOrderNumber || "-"}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Project No.</p>
              <p className="font-medium">{projectDetail?.project.projectNumber || "-"}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Project Cost</p>
              <p className="font-medium">{projectDetail ? money(projectDetail.project.contractValue) : "-"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Bills</h2>
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Bill
            </button>
          </div>

          {loadingEntries ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading bills...
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bills yet. Click "Add Bill" to begin.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-xs min-w-[1600px]">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground">
                    <th className="p-2 text-left font-medium">Date</th>
                    <th className="p-2 text-left font-medium">RA Bill No.</th>
                    <th className="p-2 text-left font-medium">Bill No.</th>
                    <th className="p-2 text-left font-medium">Month</th>
                    {NUMERIC_COLUMNS.map((col) => (
                      <th key={col.key} className="p-2 text-right font-medium">
                        {col.label}
                      </th>
                    ))}
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-border/20">
                      <td className="p-2">
                        <input
                          type="date"
                          defaultValue={toDateInput(entry.date)}
                          className={inputClass}
                          onBlur={(e) =>
                            updateMutation.mutate({ id: entry.id, payload: { date: e.target.value || null } })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={entry.raBillNo}
                          className={inputClass}
                          onBlur={(e) => updateMutation.mutate({ id: entry.id, payload: { raBillNo: e.target.value } })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={entry.billNo}
                          className={inputClass}
                          onBlur={(e) => updateMutation.mutate({ id: entry.id, payload: { billNo: e.target.value } })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          defaultValue={entry.month}
                          placeholder="e.g. August 2025"
                          className={inputClass}
                          onBlur={(e) => updateMutation.mutate({ id: entry.id, payload: { month: e.target.value } })}
                        />
                      </td>
                      {NUMERIC_COLUMNS.map((col) => (
                        <td key={col.key} className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={entry[col.key] || ""}
                            className={`${inputClass} text-right`}
                            onBlur={(e) =>
                              updateMutation.mutate({
                                id: entry.id,
                                payload: { [col.key]: Number(e.target.value) || 0 }
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="p-2 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm("Delete this bill?")) deleteMutation.mutate(entry.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive"
                          title="Delete bill"
                          aria-label="Delete bill"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-secondary/20 font-medium border-t-2 border-border/50">
                    <td className="p-2" colSpan={4}>
                      TOTAL
                    </td>
                    {NUMERIC_COLUMNS.map((col) => (
                      <td key={col.key} className="p-2 text-right tabular-nums">
                        {money(totals[col.key])}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}
