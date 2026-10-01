import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectBillingEntry } from "@/lib/domain";
import {
  applyAutoCalc,
  BillFormFields,
  billFormFromEntry,
  billFormToPayload,
  emptyBillForm,
  type BillFormState
} from "@/components/billing/BillFormFields";
import { Landmark, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AccountsBillingLedger() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showAddBill, setShowAddBill] = useState(false);
  const [addForm, setAddForm] = useState<BillFormState>(emptyBillForm);
  const [editingBill, setEditingBill] = useState<ProjectBillingEntry | null>(null);
  const [editForm, setEditForm] = useState<BillFormState>(emptyBillForm);

  const { data: eligibleProjects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["billing-projects"],
    queryFn: () => api.getFinancialProjects(),
    staleTime: 5 * 60 * 1000
  });

  const projectFromUrl = searchParams.get("project") || "";

  useEffect(() => {
    if (projectFromUrl && eligibleProjects.some((project) => project.id === projectFromUrl)) {
      setSelectedProjectId(projectFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFromUrl, eligibleProjects.length]);

  const activeProjectId = selectedProjectId || projectFromUrl || eligibleProjects[0]?.id || "";

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
    mutationFn: () => api.createProjectBillingEntry(activeProjectId, billFormToPayload(addForm)),
    onSuccess: async () => {
      toast.success("Bill added");
      setShowAddBill(false);
      setAddForm(emptyBillForm);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add bill")
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingBill) throw new Error("No bill selected");
      return api.updateProjectBillingEntry(editingBill.id, billFormToPayload(editForm));
    },
    onSuccess: async () => {
      toast.success("Bill saved");
      setEditingBill(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save bill")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProjectBillingEntry(id),
    onSuccess: async () => {
      toast.success("Bill deleted");
      setEditingBill(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete")
  });

  const totals = useMemo(
    () => ({
      basicAmountClaimed: entries.reduce((s, e) => s + (e.basicAmountClaimed || 0), 0),
      totalAmount: entries.reduce((s, e) => s + (e.totalAmount || 0), 0),
      chequeAmount: entries.reduce((s, e) => s + (e.chequeAmount || 0), 0)
    }),
    [entries]
  );

  function openEdit(entry: ProjectBillingEntry) {
    setEditingBill(entry);
    setEditForm(billFormFromEntry(entry));
  }

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title inline-flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Billing
        </h1>
        <p className="page-subtitle">Per-project RA bill ledger — claim, GST, and payment received breakdown.</p>
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
            <div>
              <h2 className="text-base font-semibold">Bills</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Click a bill to view or edit its full details.</p>
            </div>
            <Button
              className="gap-1.5"
              onClick={() => {
                setAddForm(emptyBillForm);
                setShowAddBill(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Bill
            </Button>
          </div>

          {loadingEntries ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading bills...
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No bills yet. Click "Add Bill" to begin.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => openEdit(entry)}
                  className="w-full text-left rounded-xl border border-border/40 bg-secondary/20 hover:bg-secondary/30 transition-colors p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {entry.raBillNo || entry.billNo || "Bill"}
                      {entry.month ? ` — ${entry.month}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(entry.date)} · Claimed {money(entry.basicAmountClaimed)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{money(entry.totalAmount)}</p>
                      <p className="text-[11px] text-muted-foreground">Total Amount</p>
                    </div>
                    <Badge variant={entry.chequeAmount > 0 ? "default" : "secondary"}>
                      {entry.chequeAmount > 0 ? "Passed" : "Remaining"}
                    </Badge>
                  </div>
                </button>
              ))}
              <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 flex flex-wrap items-center justify-between gap-3 font-medium">
                <p>TOTAL ({entries.length} bills)</p>
                <div className="flex gap-6 text-sm">
                  <span>Claimed: {money(totals.basicAmountClaimed)}</span>
                  <span>Total: {money(totals.totalAmount)}</span>
                  <span>Received: {money(totals.chequeAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddBill} onOpenChange={setShowAddBill}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Bill</DialogTitle>
            <DialogDescription>Nothing here is required — fill in whatever applies.</DialogDescription>
          </DialogHeader>
          <BillFormFields
            value={addForm}
            onChange={(patch) => {
              const changedKey = Object.keys(patch)[0] as keyof BillFormState;
              setAddForm((prev) => applyAutoCalc({ ...prev, ...patch }, changedKey));
            }}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowAddBill(false)}>
              Cancel
            </Button>
            <Button disabled={addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Saving..." : "Save Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingBill)} onOpenChange={(open) => !open && setEditingBill(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>
              {editingBill ? `${editingBill.raBillNo || editingBill.billNo || "Bill"} — edit and save, or delete.` : ""}
            </DialogDescription>
          </DialogHeader>
          <BillFormFields
            value={editForm}
            onChange={(patch) => {
              const changedKey = Object.keys(patch)[0] as keyof BillFormState;
              setEditForm((prev) => applyAutoCalc({ ...prev, ...patch }, changedKey));
            }}
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (editingBill && window.confirm("Delete this bill?")) deleteMutation.mutate(editingBill.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditingBill(null)}>
                Cancel
              </Button>
              <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
