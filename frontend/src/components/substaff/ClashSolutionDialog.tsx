import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SubStaffClashSolution } from "@/lib/domain";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type EditableAllocation = SubStaffClashSolution["allocations"][number];

/**
 * On-demand AI suggestion for one staff member's clash (shown only when they're on 2+ projects that
 * genuinely compete for their time). Never calls the AI automatically — only when "Get AI Suggestion"
 * is clicked, since each call spends real OpenRouter tokens. The result is fully editable before
 * applying: both the written rationale and the day numbers themselves.
 */
export function ClashSolutionDialog({ staffName, onClose }: { staffName: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [explanation, setExplanation] = useState("");
  const [allocations, setAllocations] = useState<EditableAllocation[]>([]);
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 1 + i);

  useEffect(() => {
    if (!staffName) {
      setExplanation("");
      setAllocations([]);
    }
  }, [staffName]);

  const solutionMutation = useMutation({
    mutationFn: () => api.getSubStaffClashSolution(staffName ?? "", year, month),
    onSuccess: (result) => {
      setExplanation(result.explanation);
      setAllocations(result.allocations);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not get an AI suggestion")
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      for (const a of allocations) {
        await api.setSubStaffPlanDay(a.assignmentId, year, month, "construction", a.constructionDays);
        await api.setSubStaffPlanDay(a.assignmentId, year, month, "dlp", a.dlpDays);
      }
    },
    onSuccess: async () => {
      toast.success("Applied — planned days updated for this month");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sub-staff-plan", year, month] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-project-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-profile"] })
      ]);
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not apply the plan")
  });

  const totalDays = allocations.reduce((s, a) => s + (a.constructionDays || 0) + (a.dlpDays || 0), 0);

  function updateAllocation(assignmentId: string, field: "constructionDays" | "dlpDays", value: number) {
    setAllocations((prev) => prev.map((a) => (a.assignmentId === assignmentId ? { ...a, [field]: value } : a)));
  }

  return (
    <Dialog open={Boolean(staffName)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI suggestion for {staffName}
          </DialogTitle>
          <DialogDescription>
            Proposes how to split this person's days across their competing projects for one month,
            factoring in each project's remaining time and rate. Nothing is called automatically — click
            below when you want a suggestion, then review, edit and apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={solutionMutation.isPending}
              onClick={() => solutionMutation.mutate()}
            >
              {solutionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Asking AI…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Get AI Suggestion
                </>
              )}
            </Button>
          </div>

          {allocations.length > 0 ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Rationale (edit freely, or write your own)
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Proposed days for {MONTH_NAMES[month - 1]} {year}</p>
                <Badge variant={totalDays > 30 ? "destructive" : "secondary"}>{totalDays.toFixed(1)} / 30 days</Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="bg-secondary/30 text-muted-foreground">
                      <th className="p-2 text-left font-medium">Project</th>
                      <th className="p-2 text-left font-medium">Designation</th>
                      <th className="p-2 text-right font-medium">Construction Days</th>
                      <th className="p-2 text-right font-medium">DLP Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.assignmentId} className="border-t border-border/20">
                        <td className="p-2">{a.siteName}</td>
                        <td className="p-2">{a.designation || "—"}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max="31"
                            step="0.5"
                            value={a.constructionDays}
                            onChange={(e) =>
                              updateAllocation(a.assignmentId, "constructionDays", Number(e.target.value) || 0)
                            }
                            className="w-20 text-right px-2 py-1 rounded-lg bg-secondary/50 border border-border/50"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max="31"
                            step="0.5"
                            value={a.dlpDays}
                            onChange={(e) => updateAllocation(a.assignmentId, "dlpDays", Number(e.target.value) || 0)}
                            className="w-20 text-right px-2 py-1 rounded-lg bg-secondary/50 border border-border/50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            disabled={allocations.length === 0 || applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" /> Applying…
              </>
            ) : (
              "Apply this plan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
