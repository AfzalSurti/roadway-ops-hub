import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadProjectStaffReport } from "@/lib/sub-staff-pdf";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Every staff member on one project, Active and Left — opened by clicking a project name anywhere. */
export function ProjectProfileDialog({
  projectName,
  onClose
}: {
  projectName: string | null;
  onClose: () => void;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sub-staff-project-profile", projectName],
    queryFn: () => api.getSubStaffAssignments({ siteName: projectName ?? undefined }),
    enabled: Boolean(projectName)
  });

  const normalized = projectName?.trim().toLowerCase();
  const matches = rows.filter((r) => r.siteName.trim().toLowerCase() === normalized);
  const totalMm = matches.reduce((s, r) => s + r.totalMm, 0);
  const usedMm = matches.reduce((s, r) => s + r.usedMm, 0);

  return (
    <Dialog open={Boolean(projectName)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectName}</DialogTitle>
          <DialogDescription>
            {matches.length} staff record(s) on this project — Total MM {totalMm.toFixed(2)} · Used{" "}
            {usedMm.toFixed(2)} · Balance {(totalMm - usedMm).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No staff records found for this project.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-xs min-w-[820px]">
              <thead>
                <tr className="bg-secondary/30 text-muted-foreground">
                  <th className="p-2 text-left font-medium">Staff Name</th>
                  <th className="p-2 text-left font-medium">Designation</th>
                  <th className="p-2 text-left font-medium">Co-Ordinator</th>
                  <th className="p-2 text-right font-medium">Rate</th>
                  <th className="p-2 text-right font-medium">Total MM</th>
                  <th className="p-2 text-right font-medium">Used MM</th>
                  <th className="p-2 text-right font-medium">Balance MM</th>
                  <th className="p-2 text-left font-medium">Start</th>
                  <th className="p-2 text-left font-medium">End</th>
                  <th className="p-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((entry) => (
                  <tr key={entry.id} className="border-t border-border/20">
                    <td className="p-2 font-medium">{entry.staffName}</td>
                    <td className="p-2">{entry.designation || "—"}</td>
                    <td className="p-2">{entry.coOrdinator || "—"}</td>
                    <td className="p-2 text-right tabular-nums">{money(entry.rate)}</td>
                    <td className="p-2 text-right tabular-nums">{entry.totalMm.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{entry.usedMm.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums font-medium">
                      {(entry.totalMm - entry.usedMm).toFixed(2)}
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatDate(entry.startDate)}</td>
                    <td className="p-2 whitespace-nowrap">{formatDate(entry.endDate)}</td>
                    <td className="p-2">
                      <Badge variant={entry.status === "ACTIVE" ? "secondary" : "outline"}>{entry.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={matches.length === 0}
            onClick={() => projectName && downloadProjectStaffReport(projectName, matches)}
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
