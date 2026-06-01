import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DprReportStatus, ProjectDprOverviewItem, ProjectItem } from "@/lib/domain";
import { dprReportStatusConfig } from "@/lib/domain";

const STATUS_OPTIONS = ["NOT_STARTED", "UNDER_PREPARATION", "DRAFT_SUBMITTED", "UNDER_APPROVAL", "APPROVED"] as const satisfies readonly DprReportStatus[];

type DprStatusModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectItem | null;
  overview: ProjectDprOverviewItem | null;
  onSave: (payload: { projectId: string; status: DprReportStatus; data: Record<string, unknown> | null }) => Promise<void>;
  onDelete: (overviewId: string) => Promise<void>;
  saving?: boolean;
  deleting?: boolean;
};

export function DprStatusModal({
  open,
  onOpenChange,
  project,
  overview,
  onSave,
  onDelete,
  saving = false,
  deleting = false
}: DprStatusModalProps) {
  const [status, setStatus] = useState<DprReportStatus>("NOT_STARTED");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus(overview?.status ?? "NOT_STARTED");
    const data = overview?.data;
    const candidateNotes =
      data && typeof data === "object" && !Array.isArray(data) && typeof (data as { notes?: unknown }).notes === "string"
        ? String((data as { notes?: unknown }).notes)
        : "";
    setNotes(candidateNotes);
  }, [open, overview]);

  const headerTitle = useMemo(() => {
    if (!project) return "DPR Status";
    return `${project.name} DPR Status`;
  }, [project]);

  const handleSave = async () => {
    if (!project) return;
    await onSave({
      projectId: project.id,
      status,
      data: notes.trim() ? { notes: notes.trim() } : null
    });
  };

  const handleDelete = async () => {
    if (!overview) return;
    await onDelete(overview.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
          <DialogDescription>
            Update the DPR stage for this project and keep a short working note for HOD review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dpr-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as DprReportStatus)}>
              <SelectTrigger id="dpr-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {dprReportStatusConfig[option].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dpr-notes">Notes</Label>
            <Textarea
              id="dpr-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={7}
              placeholder="Add brief DPR notes, links, or next actions"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {overview && (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || deleting || !project}>
            {saving ? "Saving…" : overview ? "Update Status" : "Create Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
