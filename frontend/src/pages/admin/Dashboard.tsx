import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { ListTodo, AlertTriangle, MessageSquare, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskItem } from "@/lib/domain";
import { isTaskOverdue } from "@/lib/domain";

function getProjectLabel(task: TaskItem): string {
  return task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim() || "Unknown";
}

function computeStats(tasks: TaskItem[]) {
  const now = new Date();
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "TODO" && !t.managerReviewComments).length,
    overdue: tasks.filter((t) => isTaskOverdue(t)).length,
    adminCommentPending: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    compliancePending: tasks.filter((t) => t.status === "TODO" && !!t.managerReviewComments).length,
    complete: tasks.filter((t) => t.status === "DONE").length,
  };
}

export default function AdminDashboard() {
  const [selectedProject, setSelectedProject] = useState<string>("ALL");

  const { data: tasksData } = useQuery({
    queryKey: ["tasks", "admin-shared"],
    queryFn: () => api.getTasks({ limit: 500 })
  });
  const tasks = tasksData?.items ?? [];

  const projectRows = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    tasks.forEach((task) => {
      const key = getProjectLabel(task);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, ...computeStats(items) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const projectOptions = useMemo(() => projectRows.map((r) => r.name), [projectRows]);

  const filteredTasks = useMemo(
    () => selectedProject === "ALL" ? tasks : tasks.filter((t) => getProjectLabel(t) === selectedProject),
    [tasks, selectedProject]
  );

  const totals = useMemo(() => computeStats(filteredTasks), [filteredTasks]);

  const tableRows = selectedProject === "ALL" ? projectRows : projectRows.filter((r) => r.name === selectedProject);

  const kpis = [
    { label: "Total Tasks", value: totals.total, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: totals.pending, icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Admin Comment Pending", value: totals.adminCommentPending, icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-400/10" },
    { label: "Compliance Pending", value: totals.compliancePending, icon: RotateCcw, color: "text-indigo-400", bg: "bg-indigo-400/10" },
    { label: "Overdue", value: totals.overdue, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
    { label: "Completed", value: totals.complete, icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your operations</p>
      </div>

      {/* Project filter */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-muted-foreground shrink-0">Project</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm w-64"
          aria-label="Filter by project"
        >
          <option value="ALL">All Projects</option>
          {projectOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${kpi.bg} w-fit mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Project-wise breakdown table */}
      <div className="glass-panel p-6">
        <h3 className="font-semibold mb-4">Project-wise Breakdown</h3>
        {tableRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tasks found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Project</th>
                  <th className="text-center py-3 px-4 font-medium text-primary">Total Tasks</th>
                  <th className="text-center py-3 px-4 font-medium text-blue-400">Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-orange-400">Admin Comment Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-indigo-400">Compliance Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-warning">Overdue</th>
                  <th className="text-center py-3 px-4 font-medium text-accent">Complete</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.name} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4 font-medium truncate max-w-[200px]">{row.name}</td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold">{row.total}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-blue-400/10 text-blue-400 font-semibold">{row.pending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-orange-400/10 text-orange-400 font-semibold">{row.adminCommentPending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-indigo-400/10 text-indigo-400 font-semibold">{row.compliancePending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-warning/10 text-warning font-semibold">{row.overdue}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-accent/10 text-accent font-semibold">{row.complete}</span>
                    </td>
                  </tr>
                ))}
                {selectedProject === "ALL" && tableRows.length > 1 && (
                  <tr className="border-t-2 border-border/50 bg-secondary/10">
                    <td className="py-3 pr-4 font-bold">Total</td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold">{totals.total}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-blue-400/10 text-blue-400 font-bold">{totals.pending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-orange-400/10 text-orange-400 font-bold">{totals.adminCommentPending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-indigo-400/10 text-indigo-400 font-bold">{totals.compliancePending}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-warning/10 text-warning font-bold">{totals.overdue}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-lg bg-accent/10 text-accent font-bold">{totals.complete}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}