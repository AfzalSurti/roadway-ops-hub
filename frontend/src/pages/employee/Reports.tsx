import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportStatusConfig } from "@/lib/domain";

export default function EmployeeReports() {
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const { data } = useQuery({ queryKey: ["reports", "employee"], queryFn: () => api.getReports({ limit: 100 }) });
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "employee-report-ratings"], queryFn: () => api.getTasks({ limit: 200 }) });
  const myReports = data?.items ?? [];
  const myTasks = tasksData?.items ?? [];

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    myTasks.forEach((task) => {
      const label = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      if (label) projects.add(label);
    });
    return ["ALL", ...Array.from(projects).sort((a, b) => a.localeCompare(b))];
  }, [myTasks]);

  const filteredReports = useMemo(() => {
    return myReports.filter((report) => {
      const task = report.task;
      const projectLabel = task?.projectNumber?.trim() || task?.projectCode?.trim() || task?.project?.trim();
      const reportDate = new Date(report.createdAt);
      const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

      const matchesProject = selectedProject === "ALL" || projectLabel === selectedProject;
      const matchesFrom = !from || reportDate >= from;
      const matchesTo = !to || reportDate <= to;

      return matchesProject && matchesFrom && matchesTo;
    });
  }, [myReports, selectedProject, fromDate, toDate]);

  const ratingScopeTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const projectLabel = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      const taskDate = new Date(task.allocatedAt ?? task.createdAt);
      const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

      const matchesProject = selectedProject === "ALL" || projectLabel === selectedProject;
      const matchesFrom = !from || taskDate >= from;
      const matchesTo = !to || taskDate <= to;

      return matchesProject && matchesFrom && matchesTo;
    });
  }, [myTasks, selectedProject, fromDate, toDate]);

  const overallAverageRating = useMemo(() => {
    const rated = ratingScopeTasks.filter((task) => typeof task.rating === "number");
    if (!rated.length) return "-";
    const avg = rated.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / rated.length;
    return avg.toFixed(2);
  }, [ratingScopeTasks]);

  const projectRatingRows = useMemo(() => {
    const grouped = new Map<string, number[]>();

    ratingScopeTasks.forEach((task) => {
      if (typeof task.rating !== "number") return;
      const key = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim() || "Uncategorized";
      grouped.set(key, [...(grouped.get(key) ?? []), Number(task.rating)]);
    });

    return Array.from(grouped.entries())
      .map(([project, ratings]) => {
        const avg = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        return { project, avgRating: avg.toFixed(2), taskCount: ratings.length };
      })
      .sort((a, b) => a.project.localeCompare(b.project));
  }, [ratingScopeTasks]);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">My Reports</h1>
        <p className="page-subtitle">Track reports with project-wise and overall rating</p>
      </div>

      <div className="glass-panel p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Project</label>
          <select
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
            title="Select Project"
            aria-label="Select Project"
          >
            {projectOptions.map((project) => (
              <option key={project} value={project}>
                {project === "ALL" ? "All Projects" : project}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          />
        </div>

        <div className="rounded-xl border border-border/50 px-3 py-2 bg-secondary/20 flex flex-col justify-center">
          <p className="text-xs text-muted-foreground">Overall Avg Rating</p>
          <p className="text-lg font-semibold">{overallAverageRating}</p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-sm font-semibold">Project-wise Rating</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground">
                <th className="text-left p-3 font-medium">Project</th>
                <th className="text-left p-3 font-medium">Rated Tasks</th>
                <th className="text-left p-3 font-medium">Avg Rating</th>
              </tr>
            </thead>
            <tbody>
              {projectRatingRows.map((row) => (
                <tr key={row.project} className="border-b border-border/20 last:border-b-0">
                  <td className="p-3">{row.project}</td>
                  <td className="p-3">{row.taskCount}</td>
                  <td className="p-3 font-medium">{row.avgRating}</td>
                </tr>
              ))}
              {projectRatingRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-muted-foreground">No ratings available for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredReports.length > 0 ? (
        <div className="space-y-3">
          {filteredReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{report.task?.title ?? report.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {(report.task?.projectNumber || report.task?.projectCode || report.task?.project || "Project")} · {report.reportTemplate?.name ?? "Template"} · Submitted {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={cn("status-badge shrink-0", reportStatusConfig[report.status].color)}>
                  {reportStatusConfig[report.status].label}
                </span>
              </div>
              {report.adminFeedback && (
                <div className="mt-3 ml-14 p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-warning mb-1">Feedback</p>
                  <p className="text-sm">{report.adminFeedback}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-12 text-center text-muted-foreground">
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No reports found for selected filters.</p>
        </div>
      )}
    </PageWrapper>
  );
}