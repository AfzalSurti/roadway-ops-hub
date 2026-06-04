import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectItem, TaskItem } from "@/lib/domain";
import {
  formatHodDate,
  getCompanyLabel,
  getProjectCompanyCode,
  getHodTaskActivityDate,
  getHodTaskActivityLabel,
  getHodTaskActivityStatus,
  getHodTaskActivityTone,
  shouldShowHodActivityDate,
  getProjectLifecycle,
  getSubTechnicalUnitLabel,
  getTechnicalUnitLabel
} from "@/lib/hod-dashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { buildProjectDprReportStatuses, getDprReportDisplayDate, getDprReportStatusTone } from "@/lib/hod-dpr-reports";
import { HodActivityStatusDisplay } from "@/components/hod/HodActivityStatusDisplay";
import { Loader2 } from "lucide-react";

type HodProjectDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectItem | null;
  projectTasks: TaskItem[];
};

export function HodProjectDetailDialog({ open, onOpenChange, project, projectTasks }: HodProjectDetailDialogProps) {
  const lifecycle = getProjectLifecycle(projectTasks);
  const dprReports = buildProjectDprReportStatuses(projectTasks);

  const { data: commentsByTaskId = {}, isFetching: loadingComments } = useQuery({
    queryKey: ["hod-task-comments", project?.id, projectTasks.map((task) => task.id).join(",")],
    enabled: open && projectTasks.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        projectTasks.map(async (task) => {
          const comments = await api.getTaskComments(task.id);
          return [task.id, comments] as const;
        })
      );
      return Object.fromEntries(entries);
    }
  });

  if (!project) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project.name}</DialogTitle>
          <DialogDescription>
            {project.projectNumber || "No project number"} · {lifecycle === "COMPLETED" ? "Completed" : "Ongoing"} project
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <InfoField label="Project Number" value={project.projectNumber ?? "-"} />
          <InfoField label="Organization" value={getCompanyLabel(getProjectCompanyCode(project))} />
          <InfoField label="Technical Unit" value={getTechnicalUnitLabel(project.technicalUnitCode)} />
          <InfoField
            label="Sub Technical Unit"
            value={getSubTechnicalUnitLabel(project.technicalUnitCode, project.subTechnicalUnitCode)}
          />
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">DPR report status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {dprReports.map((report) => (
              <div
                key={report.key}
                className={`rounded-lg border px-2.5 py-2 text-xs ${getDprReportStatusTone(report.status)}`}
                title={report.taskCount ? `${report.taskCount} linked task(s)` : "No linked tasks"}
              >
                <p className="font-medium leading-tight">{report.shortLabel}</p>
                <HodActivityStatusDisplay
                  status={report.status}
                  label={report.statusLabel}
                  date={getDprReportDisplayDate(report)}
                  className="mt-1 items-start"
                  labelClassName="font-semibold"
                  dateClassName="text-[10px] opacity-90"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2">Task activity</h3>
          {projectTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/60 p-6 text-center">
              No tasks assigned to this project yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/30 text-muted-foreground">
                    <th className="py-2.5 px-3 text-left font-medium">Task</th>
                    <th className="py-2.5 px-3 text-left font-medium">Assigned To</th>
                    <th className="py-2.5 px-3 text-left font-medium">Status</th>
                    <th className="py-2.5 px-3 text-left font-medium">Submission</th>
                    <th className="py-2.5 px-3 text-left font-medium">Approval</th>
                    <th className="py-2.5 px-3 text-left font-medium">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map((task) => {
                    const activityStatus = getHodTaskActivityStatus(task);
                    const activityDate = getHodTaskActivityDate(activityStatus, task);
                    const comments = commentsByTaskId[task.id] ?? [];
                    return (
                      <tr key={task.id} className="border-b border-border/20">
                        <td className="py-2.5 px-3 font-medium max-w-[220px]">{task.title}</td>
                        <td className="py-2.5 px-3">{task.assignedTo?.name ?? "-"}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="secondary" className={`rounded-full ${getHodTaskActivityTone(activityStatus)}`}>
                              {getHodTaskActivityLabel(activityStatus)}
                            </Badge>
                            {shouldShowHodActivityDate(activityStatus, activityDate) ? (
                              <span className="text-xs text-muted-foreground">{activityDate}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatHodDate(task.submittedForReviewAt ?? task.actualCompletedAt)}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{formatHodDate(task.reviewCompletedAt)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[200px]">
                          {comments.length === 0 ? (
                            "-"
                          ) : (
                            <span title={comments.map((item) => item.body).join("\n")}>{comments.length} comment(s)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loadingComments ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading comments...
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
