import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SubStaffAssignment } from "@/lib/domain";
import {
  SubStaffFormFields,
  emptySubStaffForm,
  subStaffFormToPayload,
  applySubStaffDefaults,
  type ProjectOption,
  type SubStaffFormState
} from "@/components/substaff/SubStaffFormFields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

function round2(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

/** YYYY-MM-DD plus one day, using local-date arithmetic (matches SubStaffFormFields' own date math). */
function addOneDay(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Ends one person's assignment on a chosen date (preserved as history, status LEFT) and opens a
 * prefilled new assignment for whoever takes over the same slot — same project, designation, rate and
 * period/phase numbers, starting the day after, with the remaining man-months carried over as their
 * starting balance. Opened from an individual project's staff list. */
export function ReplaceStaffDialog({
  assignment,
  onClose,
  designationOptions,
  staffNameOptions,
  projectOptions
}: {
  assignment: SubStaffAssignment | null;
  onClose: () => void;
  designationOptions: string[];
  staffNameOptions: string[];
  projectOptions: ProjectOption[];
}) {
  const queryClient = useQueryClient();
  const [lastDay, setLastDay] = useState(todayInput());
  const [newForm, setNewForm] = useState<SubStaffFormState>(emptySubStaffForm);

  useEffect(() => {
    if (!assignment) return;
    const defaultLastDay = todayInput();
    setLastDay(defaultLastDay);
    const remainingMm = round2(assignment.totalMm - assignment.usedMm);
    setNewForm({
      ...emptySubStaffForm,
      projectId: assignment.projectId || "",
      siteName: assignment.siteName,
      projectNumber: assignment.projectNumber || "",
      designation: assignment.designation,
      coOrdinator: assignment.coOrdinator,
      rate: assignment.rate ? String(assignment.rate) : "",
      constructionPeriodMonths: assignment.constructionPeriodMonths ? String(assignment.constructionPeriodMonths) : "",
      dlpMonths: assignment.dlpMonths ? String(assignment.dlpMonths) : "",
      eotMonths: assignment.eotMonths ? String(assignment.eotMonths) : "",
      totalPeriodMonths: assignment.totalPeriodMonths ? String(assignment.totalPeriodMonths) : "",
      startDate: addOneDay(defaultLastDay),
      endDate: toDateInput(assignment.endDate),
      totalMm: remainingMm > 0 ? String(remainingMm) : "",
      usedMm: "0",
      remark: `Replacement for ${assignment.staffName} (left ${defaultLastDay})`
    });
  }, [assignment]);

  const replaceMutation = useMutation({
    mutationFn: async () => {
      if (!assignment) return;
      await api.updateSubStaffAssignment(assignment.id, { endDate: lastDay, status: "LEFT" });
      await api.createSubStaffAssignment(subStaffFormToPayload(newForm));
    },
    onSuccess: async () => {
      toast.success("Replacement recorded — the previous assignment is kept as history");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sub-staff-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-clashes"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-project-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["sub-staff-plan"] })
      ]);
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record the replacement")
  });

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Replace {assignment?.staffName}
          </DialogTitle>
          <DialogDescription>
            {assignment?.staffName}'s record as {assignment?.designation || "—"} on {assignment?.siteName} is kept,
            marked Left as of their last day. The new person below takes over the same slot from the next day,
            starting with the remaining balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {assignment?.staffName}'s last day on this assignment
            </label>
            <input
              type="date"
              value={lastDay}
              onChange={(e) => {
                const value = e.target.value;
                setLastDay(value);
                setNewForm((prev) => applySubStaffDefaults({ ...prev, startDate: addOneDay(value) }, "startDate"));
              }}
              className="w-full max-w-[220px] px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">New staff member (takes over this slot)</p>
            <SubStaffFormFields
              value={newForm}
              onChange={(patch) => {
                const changedKey = Object.keys(patch)[0] as keyof SubStaffFormState;
                setNewForm((prev) => applySubStaffDefaults({ ...prev, ...patch }, changedKey));
              }}
              designationOptions={designationOptions}
              staffNameOptions={staffNameOptions}
              projectOptions={projectOptions}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!newForm.staffName.trim() || replaceMutation.isPending}
            onClick={() => replaceMutation.mutate()}
          >
            {replaceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…
              </>
            ) : (
              "Confirm replacement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
