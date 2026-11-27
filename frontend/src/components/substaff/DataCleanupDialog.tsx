import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectOption } from "@/components/substaff/SubStaffFormFields";

const selectClass = "w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm";
const inputClass = selectClass;
const labelClass = "text-xs text-muted-foreground mb-1 block";

/**
 * Fixes the duplicate-Project problem that comes from name mismatches between modules — e.g. Billing's
 * project entered as "Nandyal" while the staff register uses "MORTH NANDYAL" creates two separate
 * Project records for the same real site. This repoints every Sub-Staff assignment from the duplicate
 * onto the real one (it does not touch or delete the duplicate Project record itself — once nothing on
 * this page references it, it can be removed from Admin > Projects directly, with that page's own
 * safeguards). Also fixes designation spelling inconsistencies (e.g. "CAD EXPERT" vs "CAD Expert") the
 * same way, across every record at once.
 */
export function DataCleanupDialog({
  open,
  onClose,
  projectOptions,
  designationOptions
}: {
  open: boolean;
  onClose: () => void;
  projectOptions: ProjectOption[];
  designationOptions: string[];
}) {
  const queryClient = useQueryClient();
  const [fromProjectId, setFromProjectId] = useState("");
  const [toProjectId, setToProjectId] = useState("");
  const [fromDesignation, setFromDesignation] = useState("");
  const [toDesignation, setToDesignation] = useState("");

  const refreshSubStaff = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sub-staff-assignments"] }),
      queryClient.invalidateQueries({ queryKey: ["sub-staff-plan"] }),
      queryClient.invalidateQueries({ queryKey: ["sub-staff-clashes"] }),
      queryClient.invalidateQueries({ queryKey: ["sub-staff-options"] })
    ]);

  const reassignMutation = useMutation({
    mutationFn: () => api.bulkReassignSubStaffProject(fromProjectId, toProjectId),
    onSuccess: async (result) => {
      toast.success(
        `Moved ${result.updatedCount} record(s) from "${result.fromProjectName}" to "${result.toProjectName}"`
      );
      setFromProjectId("");
      setToProjectId("");
      await refreshSubStaff();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reassign the project")
  });

  const renameMutation = useMutation({
    mutationFn: () => api.bulkRenameSubStaffDesignation(fromDesignation, toDesignation.trim()),
    onSuccess: async (result) => {
      toast.success(`Renamed ${result.updatedCount} record(s) to "${toDesignation.trim()}"`);
      setFromDesignation("");
      setToDesignation("");
      await refreshSubStaff();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not rename the designation")
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fix duplicate projects / designations</DialogTitle>
          <DialogDescription>
            For when the same real site or role ended up as two different entries (e.g. a project name
            without "MORTH"/"NHAI" vs. one with it).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Merge a duplicate project into the real one</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Duplicate project (move staff off this one)</label>
                <select value={fromProjectId} onChange={(e) => setFromProjectId(e.target.value)} className={selectClass}>
                  <option value="">Select project</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectNumber ? `${p.name} (${p.projectNumber})` : p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Real project (move staff onto this one)</label>
                <select value={toProjectId} onChange={(e) => setToProjectId(e.target.value)} className={selectClass}>
                  <option value="">Select project</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectNumber ? `${p.name} (${p.projectNumber})` : p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Only moves Sub-Staff Planning records — the now-empty duplicate project itself isn't deleted
              here; remove it from Admin &gt; Projects once nothing references it anymore.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!fromProjectId || !toProjectId || fromProjectId === toProjectId || reassignMutation.isPending}
              onClick={() => reassignMutation.mutate()}
            >
              {reassignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Moving…
                </>
              ) : (
                "Merge projects"
              )}
            </Button>
          </div>

          <div className="space-y-3 border-t border-border/30 pt-4">
            <p className="text-xs font-medium text-muted-foreground">Rename a designation everywhere it's used</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Current spelling</label>
                <select
                  value={fromDesignation}
                  onChange={(e) => setFromDesignation(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select designation</option>
                  {designationOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Rename to</label>
                <input
                  value={toDesignation}
                  onChange={(e) => setToDesignation(e.target.value)}
                  placeholder="Canonical spelling"
                  className={inputClass}
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!fromDesignation || !toDesignation.trim() || renameMutation.isPending}
              onClick={() => renameMutation.mutate()}
            >
              {renameMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Renaming…
                </>
              ) : (
                "Rename designation"
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
