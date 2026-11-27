import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

/** Opened from a "Find open positions" action on a Completed row — looks for other ACTIVE assignments
 * in the same designation that are still unfilled ("TO BE NAME") placeholders, so a now-free staff
 * member can be moved straight into one instead of sitting idle. */
export function ReassignmentSuggestionsDialog({
  assignmentId,
  onClose
}: {
  assignmentId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sub-staff-reassignment-suggestions", assignmentId],
    queryFn: () => api.getSubStaffReassignmentSuggestions(assignmentId ?? ""),
    enabled: Boolean(assignmentId)
  });

  const fillMutation = useMutation({
    mutationFn: ({ openSlotAssignmentId, staffName }: { openSlotAssignmentId: string; staffName: string }) =>
      api.fillSubStaffOpenSlot(openSlotAssignmentId, staffName),
    onSuccess: async () => {
      toast.success("Assigned to the open position");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sub-staff-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-plan"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-clashes"] })
      ]);
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not fill that position")
  });

  return (
    <Dialog open={Boolean(assignmentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open positions for this designation</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.completedAssignment.staffName} just finished ${data.completedAssignment.designation} on ${data.completedAssignment.siteName}.`
              : "Looking for unfilled positions in the same designation..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">
            {error instanceof Error ? error.message : "Could not load suggestions"}
          </p>
        ) : !data || data.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No unfilled ("TO BE NAME") positions found for this designation right now.
          </p>
        ) : (
          <div className="space-y-3">
            {data.recommendation ? (
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-xs inline-flex gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{data.recommendation}</span>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-xs min-w-[460px]">
                <thead>
                  <tr className="bg-secondary/30 text-muted-foreground">
                    <th className="p-2 text-left font-medium">Project</th>
                    <th className="p-2 text-right font-medium">Rate</th>
                    <th className="p-2 text-right font-medium">Remaining Months (Constr.)</th>
                    <th className="p-2 text-right font-medium">Remaining Months (DLP)</th>
                    <th className="p-2 text-left font-medium">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {data.candidates.map((c) => (
                    <tr key={c.assignmentId} className="border-t border-border/20">
                      <td className="p-2">{c.siteName}</td>
                      <td className="p-2 text-right tabular-nums">{money(c.rate)}</td>
                      <td className="p-2 text-right tabular-nums">{c.remainingConsMonths.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">{c.remainingDlpMonths.toFixed(2)}</td>
                      <td className="p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={fillMutation.isPending}
                          onClick={() =>
                            data &&
                            fillMutation.mutate({
                              openSlotAssignmentId: c.assignmentId,
                              staffName: data.completedAssignment.staffName
                            })
                          }
                        >
                          Assign here
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
