import { useMemo } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/lib/auth";
import { ListTodo, AlertTriangle, Clock, MessageSquare, RotateCcw, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePersistentState } from "@/hooks/use-persistent-state";
import type { TaskItem } from "@/lib/domain";

function getProjectLabel(task: TaskItem): string {
  return task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim() || "Unknown";
}

function computeStats(tasks: TaskItem[]) {
  const now = new Date();
  return {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === "TODO" && !task.managerReviewComments).length,
    overdue: tasks.filter((task) => new Date(task.dueDate) < now && task.status !== "DONE").length,
    adminCommentPending: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    compliancePending: tasks.filter((task) => task.status === "TODO" && !!task.managerReviewComments).length,
    complete: tasks.filter((task) => task.status === "DONE").length,
  };
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = usePersistentState<string>("employee.dashboard.selectedProject", "ALL");
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "employee-shared"], queryFn: () => api.getTasks({ limit: 100 }) });

  const myTasks = tasksData?.items ?? [];
  const projectRows = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>();
    myTasks.forEach((task) => {
      const key = getProjectLabel(task);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    return Array.from(grouped.entries())
      .map(([name, tasks]) => ({ name, ...computeStats(tasks) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [myTasks]);

  const projectOptions = useMemo(() => projectRows.map((row) => row.name), [projectRows]);
  const filteredTasks = useMemo(
    () => (selectedProject === "ALL" ? myTasks : myTasks.filter((task) => getProjectLabel(task) === selectedProject)),
    [myTasks, selectedProject]
  );
  const totals = useMemo(() => computeStats(filteredTasks), [filteredTasks]);
  const tableRows = selectedProject === "ALL" ? projectRows : projectRows.filter((row) => row.name === selectedProject);

  const kpis = [
    { label: "Total Tasks", value: totals.total, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: totals.pending, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Admin Comment Pending", value: totals.adminCommentPending, icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-400/10" },
    { label: "Compliance Pending", value: totals.compliancePending, icon: RotateCcw, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Complete", value: totals.complete, icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" },
    { label: "Overdue", value: totals.overdue, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="page-subtitle">Here's your task overview</p>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm text-muted-foreground shrink-0">Project</label>
        <select
          value={selectedProject}
          onChange={(event) => setSelectedProject(event.target.value)}
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm w-64"
          aria-label="Filter by project"
        >
          <option value="ALL">All Projects</option>
          {projectOptions.map((project) => (
            <option key={project} value={project}>{project}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${kpi.bg} w-fit mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

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
                  <th className="text-center py-3 px-4 font-medium text-warning">Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-orange-400">Admin Comment Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-blue-400">Compliance Pending</th>
                  <th className="text-center py-3 px-4 font-medium text-destructive">Overdue</th>
                  <th className="text-center py-3 px-4 font-medium text-accent">Complete</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.name} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4 font-medium truncate max-w-[220px]">{row.name}</td>
                    <td className="text-center py-3 px-4">{row.total}</td>
                    <td className="text-center py-3 px-4">{row.pending}</td>
                    <td className="text-center py-3 px-4">{row.adminCommentPending}</td>
                    <td className="text-center py-3 px-4">{row.compliancePending}</td>
                    <td className="text-center py-3 px-4">{row.overdue}</td>
                    <td className="text-center py-3 px-4">{row.complete}</td>
                  </tr>
                ))}
                {selectedProject === "ALL" && tableRows.length > 1 && (
                  <tr className="border-t-2 border-border/50 bg-secondary/10 font-semibold">
                    <td className="py-3 pr-4">Total</td>
                    <td className="text-center py-3 px-4">{totals.total}</td>
                    <td className="text-center py-3 px-4">{totals.pending}</td>
                    <td className="text-center py-3 px-4">{totals.adminCommentPending}</td>
                    <td className="text-center py-3 px-4">{totals.compliancePending}</td>
                    <td className="text-center py-3 px-4">{totals.overdue}</td>
                    <td className="text-center py-3 px-4">{totals.complete}</td>
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