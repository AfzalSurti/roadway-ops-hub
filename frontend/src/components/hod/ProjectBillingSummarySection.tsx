import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { ProjectBillingEntry, ProjectBillingSummaryRow } from "@/lib/domain";
import { BillFormFields, billFormFromEntry } from "@/components/billing/BillFormFields";
import { Landmark, Loader2 } from "lucide-react";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Per-project billing register summary — bills created/passed/remaining and totals, click to drill in. */
export function ProjectBillingSummarySection({
  onSelectProject
}: {
  /** When provided, clicking a project row navigates away instead of opening the read-only drill-down popup. */
  onSelectProject?: (projectId: string) => void;
} = {}) {
  const [openProject, setOpenProject] = useState<ProjectBillingSummaryRow | null>(null);
  const [openBill, setOpenBill] = useState<ProjectBillingEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hod-project-billing-summary"],
    queryFn: () => api.getProjectBillingSummary(),
    staleTime: 2 * 60 * 1000
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["hod-project-billing-entries", openProject?.projectId],
    queryFn: () => api.getProjectBillingEntries(openProject!.projectId),
    enabled: Boolean(openProject)
  });

  const rows = data?.rows ?? [];
  const grandTotal = data?.grandTotal;

  return (
    <div className="glass-panel p-5 mb-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold inline-flex items-center gap-2">
          <Landmark className="h-5 w-5" /> Project Billing
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Bills raised per project from Accounts — click a project to see its individual bills.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading billing summary...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No bills recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-secondary/30 text-muted-foreground">
                <th className="p-3 text-left font-medium">Project No.</th>
                <th className="p-3 text-left font-medium">Project Name</th>
                <th className="p-3 text-right font-medium">Bills Created</th>
                <th className="p-3 text-right font-medium">Bills Passed</th>
                <th className="p-3 text-right font-medium">Bills Remaining</th>
                <th className="p-3 text-right font-medium">Total Claimed</th>
                <th className="p-3 text-right font-medium">Total Amount</th>
                <th className="p-3 text-right font-medium">Received</th>
                <th className="p-3 text-right font-medium">Remaining Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.projectId}
                  className="border-t border-border/20 hover:bg-secondary/20 cursor-pointer"
                  onClick={() => (onSelectProject ? onSelectProject(row.projectId) : setOpenProject(row))}
                >
                  <td className="p-3 font-mono text-xs">{row.projectNumber || "—"}</td>
                  <td className="p-3">{row.projectName}</td>
                  <td className="p-3 text-right tabular-nums">{row.billsCount}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-600">{row.billsPassedCount}</td>
                  <td className="p-3 text-right tabular-nums text-amber-600">{row.billsRemainingCount}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.basicAmountClaimed)}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.totalAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.chequeAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.remainingAmount)}</td>
                </tr>
              ))}
            </tbody>
            {grandTotal ? (
              <tfoot>
                <tr className="border-t-2 border-border/50 bg-secondary/30 font-semibold">
                  <td className="p-3" colSpan={2}>
                    Total ({grandTotal.billsCount} bills)
                  </td>
                  <td className="p-3 text-right tabular-nums">{grandTotal.billsCount}</td>
                  <td className="p-3 text-right tabular-nums">{grandTotal.billsPassedCount}</td>
                  <td className="p-3 text-right tabular-nums">{grandTotal.billsRemainingCount}</td>
                  <td className="p-3 text-right tabular-nums">{money(grandTotal.basicAmountClaimed)}</td>
                  <td className="p-3 text-right tabular-nums">{money(grandTotal.totalAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{money(grandTotal.chequeAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{money(grandTotal.remainingAmount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}

      <Dialog open={Boolean(openProject)} onOpenChange={(open) => !open && setOpenProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openProject?.projectName}</DialogTitle>
            <DialogDescription>
              {openProject?.projectNumber} — all bills for this project (read-only). Click one for full details.
            </DialogDescription>
          </DialogHeader>
          {loadingEntries ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading bills...
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No bills for this project.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setOpenBill(entry)}
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openBill)} onOpenChange={(open) => !open && setOpenBill(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>Read-only — ask Accounts to make changes.</DialogDescription>
          </DialogHeader>
          {openBill ? <BillFormFields value={billFormFromEntry(openBill)} onChange={() => undefined} readOnly /> : null}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpenBill(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
