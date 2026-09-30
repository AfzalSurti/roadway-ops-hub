import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ProjectBillingSummaryRow } from "@/lib/domain";
import { Landmark, Loader2, X } from "lucide-react";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN");
}

/** Per-project billing register summary — bills created/passed/remaining and totals, click to drill in. */
export function ProjectBillingSummarySection() {
  const [openProject, setOpenProject] = useState<ProjectBillingSummaryRow | null>(null);

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
                  onClick={() => setOpenProject(row)}
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

      {openProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{openProject.projectName}</p>
                <p className="text-xs text-muted-foreground">{openProject.projectNumber} — bills (read-only)</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOpenProject(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              {loadingEntries ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading bills...
                </p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bills for this project.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/40">
                  <table className="w-full text-xs min-w-[1400px]">
                    <thead>
                      <tr className="bg-secondary/30 text-muted-foreground">
                        <th className="p-2 text-left font-medium">Date</th>
                        <th className="p-2 text-left font-medium">RA Bill No.</th>
                        <th className="p-2 text-left font-medium">Bill No.</th>
                        <th className="p-2 text-left font-medium">Month</th>
                        <th className="p-2 text-right font-medium">Basic Claimed</th>
                        <th className="p-2 text-right font-medium">Basic Passed</th>
                        <th className="p-2 text-right font-medium">18% GST</th>
                        <th className="p-2 text-right font-medium">Total Amount</th>
                        <th className="p-2 text-right font-medium">TDS</th>
                        <th className="p-2 text-right font-medium">SD/Retention</th>
                        <th className="p-2 text-right font-medium">GST</th>
                        <th className="p-2 text-right font-medium">To Receive</th>
                        <th className="p-2 text-right font-medium">Chq. Amt</th>
                        <th className="p-2 text-right font-medium">Amt Hold</th>
                        <th className="p-2 text-right font-medium">GST Received</th>
                        <th className="p-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-t border-border/20">
                          <td className="p-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="p-2">{entry.raBillNo || "—"}</td>
                          <td className="p-2">{entry.billNo || "—"}</td>
                          <td className="p-2">{entry.month || "—"}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.basicAmountClaimed)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.basicAmountPassed)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.gstAmount)}</td>
                          <td className="p-2 text-right tabular-nums font-medium">{money(entry.totalAmount)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.tds)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.sdRetention)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.gstDeduction)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.amountToReceive)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.chequeAmount)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.amountHold)}</td>
                          <td className="p-2 text-right tabular-nums">{money(entry.gstReceived)}</td>
                          <td className="p-2">
                            <Badge variant={entry.chequeAmount > 0 ? "default" : "secondary"}>
                              {entry.chequeAmount > 0 ? "Passed" : "Remaining"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
