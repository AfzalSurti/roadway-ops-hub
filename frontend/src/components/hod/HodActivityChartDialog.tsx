import { useMemo } from "react";
import type { ProjectItem, TaskItem } from "@/lib/domain";
import {
  buildHodActivityChartData,
  getHodActivityChartBarClass
} from "@/lib/hod-activity-chart";
import { formatHodDate, getHodTaskActivityLabel } from "@/lib/hod-dashboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type HodActivityChartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectItem | null;
  projectTasks: TaskItem[];
};

export function HodActivityChartDialog({
  open,
  onOpenChange,
  project,
  projectTasks
}: HodActivityChartDialogProps) {
  const chart = useMemo(() => buildHodActivityChartData(projectTasks), [projectTasks]);

  if (!project) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task Activity Chart</DialogTitle>
          <DialogDescription>
            {project.projectNumber || "No project number"} · {project.name}
          </DialogDescription>
        </DialogHeader>

        {chart.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/60 p-6 text-center">
            No chartable task activity yet. Tasks need an assigned date and progress from DPR Admin.
          </p>
        ) : (
          <div className="rounded-xl border border-border/40 p-4 bg-secondary/10">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
              <span>Y Axis: Activities</span>
              <span>
                X Axis: Timeline ({formatHodDate(chart.timelineStart?.toISOString())} to{" "}
                {formatHodDate(chart.timelineEnd?.toISOString())} · {chart.totalDays} days)
              </span>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
              <LegendItem label="Under Preparation (ongoing)" className="bg-amber-500/20 text-amber-800 border-amber-500/30" />
              <LegendItem label="Draft Submitted" className="bg-sky-500/20 text-sky-700 border-sky-500/30" />
              <LegendItem label="Approved" className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30" />
            </div>

            <div className="space-y-2">
              {chart.rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[minmax(220px,320px)_1fr] items-center gap-3">
                  <div className="text-xs leading-4">
                    <p className="font-medium text-foreground line-clamp-2">{row.title}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Start: {formatHodDate(row.startDate)} · End: {formatHodDate(row.endDate)} · {row.daysCount} day(s)
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {getHodTaskActivityLabel(row.status)}
                      {row.isOngoing ? " (in progress)" : ""}
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 1000 32"
                    preserveAspectRatio="none"
                    className="h-8 w-full rounded-lg bg-secondary/50 border border-border/40 overflow-hidden"
                    role="img"
                    aria-label={`${row.title}: ${row.daysCount} days`}
                  >
                    <rect
                      x={(row.leftPct / 100) * 1000}
                      y={2}
                      width={Math.max((row.widthPct / 100) * 1000, 12)}
                      height={28}
                      rx={6}
                      className={getHodActivityChartBarClass(row.status, row.isOngoing)}
                      opacity={row.isOngoing ? 0.75 : 0.9}
                    />
                  </svg>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border/30 pt-3">
              <svg viewBox="0 0 1000 28" preserveAspectRatio="none" className="h-7 w-full">
                {[0, 0.25, 0.5, 0.75, 1].map((point, index) => (
                  <g key={point}>
                    <line
                      x1={point * 1000}
                      y1={0}
                      x2={point * 1000}
                      y2={10}
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth="1"
                    />
                    <text x={point * 1000} y={24} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      {chart.axisDates[index]}
                    </text>
                  </g>
                ))}
              </svg>
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                Bar position shows when each activity starts and ends on the project timeline.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LegendItem({ label, className }: { label: string; className: string }) {
  return (
    <Badge variant="secondary" className={`rounded-full ${className}`}>
      {label}
    </Badge>
  );
}
