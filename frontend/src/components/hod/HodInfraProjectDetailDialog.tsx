import type { InfraProjectItem } from "@/lib/domain";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users2 } from "lucide-react";

type HodInfraProjectDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: InfraProjectItem | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function HodInfraProjectDetailDialog({ open, onOpenChange, project }: HodInfraProjectDetailDialogProps) {
  if (!project) return null;

  const active = project.assignments.filter((item) => !item.demobilizedAt);
  const closed = project.assignments.filter((item) => item.demobilizedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project.name}</DialogTitle>
          <DialogDescription>
            {project.projectNumber || "No project number"} · Infra project ({project.subTechnicalUnitCode ?? "-"}) ·{" "}
            {project.lifecycle === "COMPLETED" ? "Completed" : "Ongoing"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-4">
          <InfoField label="Project Number" value={project.projectNumber ?? "-"} />
          <InfoField label="Sub Technical Unit" value={project.subTechnicalUnitCode ?? "-"} />
          <InfoField label="Active Assignments" value={String(project.activeAssignments)} />
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users2 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Currently Mobilized Team</h4>
              <Badge variant="secondary" className="rounded-full ml-auto">
                {active.length}
              </Badge>
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees are currently mobilized on this project.</p>
            ) : (
              <div className="space-y-2">
                {active.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-border/30 bg-background/40 p-3">
                    <p className="font-medium text-sm">{assignment.teamMember.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {assignment.teamMember.manpowerGroup} · {assignment.teamMember.manpowerRole}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Email: {assignment.teamMember.email || "-"} · Phone: {assignment.teamMember.phone || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Mobilized: {formatDate(assignment.mobilizedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-semibold">Demobilized / Past Assignments</h4>
              <Badge variant="outline" className="rounded-full ml-auto">
                {closed.length}
              </Badge>
            </div>
            {closed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No demobilized history yet.</p>
            ) : (
              <div className="space-y-2">
                {closed.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-border/30 bg-background/40 p-3">
                    <p className="font-medium text-sm">{assignment.teamMember.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {assignment.teamMember.manpowerGroup} · {assignment.teamMember.manpowerRole}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mobilized: {formatDate(assignment.mobilizedAt)} · Demobilized: {formatDate(assignment.demobilizedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}
