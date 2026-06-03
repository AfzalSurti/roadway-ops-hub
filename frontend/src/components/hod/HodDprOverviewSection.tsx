import type { ProjectItem } from "@/lib/domain";
import type { TaskItem } from "@/lib/domain";
import { buildProjectDprReportStatuses, getDprReportStatusTone, HOD_DPR_REPORTS } from "@/lib/hod-dpr-reports";
import { getTasksForProject } from "@/lib/hod-dashboard";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type HodDprOverviewSectionProps = {
  projects: ProjectItem[];
  tasks: TaskItem[];
  isLoading?: boolean;
};

export function HodDprOverviewSection({ projects, tasks, isLoading = false }: HodDprOverviewSectionProps) {
  const rows = projects.map((project) => ({
    project,
    reports: buildProjectDprReportStatuses(getTasksForProject(project, tasks))
  }));

  return (
    <div className="glass-panel p-6 mt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">DPR report overview</h3>
          <p className="text-sm text-muted-foreground">
            Status is derived from DPR Admin task assignments for each report type.
          </p>
        </div>
        <DprStatusLegend />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1200px] border-separate border-spacing-0">
          <thead>
            <tr className="text-muted-foreground">
              <th className="sticky left-0 z-20 bg-card py-2 pr-3 text-left font-medium border-b border-border/40 min-w-[200px]">
                Project
              </th>
              {HOD_DPR_REPORTS.map((report) => (
                <th
                  key={report.key}
                  className="py-2 px-1 text-center font-medium border-b border-border/40 min-w-[72px] max-w-[88px]"
                  title={report.label}
                >
                  <span className="block leading-tight">{report.shortLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={HOD_DPR_REPORTS.length + 1} className="py-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading DPR overview...
                  </span>
                </td>
              </tr>
            ) : null}

            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={HOD_DPR_REPORTS.length + 1} className="py-10 text-center text-muted-foreground text-sm">
                  No projects match the selected filters.
                </td>
              </tr>
            ) : null}

            {!isLoading
              ? rows.map((row) => (
                  <tr key={row.project.id} className="border-b border-border/15">
                    <td className="sticky left-0 z-10 bg-card py-2 pr-3 align-top">
                      <p className="font-medium text-sm leading-tight">{row.project.projectNumber || "-"}</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2">{row.project.name}</p>
                    </td>
                    {row.reports.map((report) => (
                      <td key={report.key} className="py-2 px-1 align-top text-center">
                        <div
                          className={`rounded-md border px-1 py-1.5 min-h-[52px] flex flex-col items-center justify-center gap-0.5 ${getDprReportStatusTone(report.status)}`}
                          title={`${report.label}: ${report.statusLabel}${report.taskCount ? ` (${report.taskCount} tasks)` : ""}`}
                        >
                          <span className="font-semibold text-[10px] leading-tight">{report.statusLabel}</span>
                          {report.status === "TASK_COMPLETED" && report.submissionDate !== "-" ? (
                            <span className="text-[9px] opacity-90">{report.submissionDate}</span>
                          ) : null}
                          {report.status === "APPROVED" && report.approvalDate !== "-" ? (
                            <span className="text-[9px] opacity-90">{report.approvalDate}</span>
                          ) : null}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DprStatusLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <LegendItem label="Not started" tone="bg-muted/80 text-muted-foreground border-border/50" />
      <LegendItem label="Task pending" tone="bg-amber-500/20 text-amber-800 border-amber-500/30" />
      <LegendItem label="Task completed" tone="bg-sky-500/20 text-sky-700 border-sky-500/30" />
      <LegendItem label="Approved" tone="bg-emerald-500/20 text-emerald-700 border-emerald-500/30" />
    </div>
  );
}

function LegendItem({ label, tone }: { label: string; tone: string }) {
  return (
    <Badge variant="secondary" className={`rounded-full ${tone}`}>
      {label}
    </Badge>
  );
}
