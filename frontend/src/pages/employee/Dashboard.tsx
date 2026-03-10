import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/lib/auth";
import { ListTodo, AlertTriangle, Star, Clock, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "employee-dashboard"], queryFn: () => api.getTasks({ limit: 100 }) });

  const myTasks = tasksData?.items ?? [];
  const pendingTasks = myTasks.filter((task) => task.status !== "DONE");
  const overdueTasks = myTasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "DONE");
  const ratedTasks = myTasks.filter((task) => typeof task.rating === "number");
  const avgRating = ratedTasks.length
    ? (ratedTasks.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / ratedTasks.length).toFixed(2)
    : "0.00";

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    myTasks.forEach((task) => {
      const label = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      if (label) projects.add(label);
    });
    return ["ALL", ...Array.from(projects).sort((a, b) => a.localeCompare(b))];
  }, [myTasks]);

  const tasksByProject = useMemo(() => {
    const base = pendingTasks.filter((task) => {
      if (selectedProject === "ALL") return true;
      const label = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      return label === selectedProject;
    });

    return [...base].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [pendingTasks, selectedProject]);

  const kpis = [
    { label: "My Tasks", value: myTasks.length, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: pendingTasks.length, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Overdue", value: overdueTasks.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Avg Rating", value: avgRating, icon: Star, color: "text-accent", bg: "bg-accent/10" }
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="page-subtitle">Here's your task overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">My Tasks (Due Date First)</h3>
          <Link to="/app/tasks" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Project</label>
          <select
            value={selectedProject}
            onChange={(event) => setSelectedProject(event.target.value)}
            className="w-full sm:w-72 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
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

        <div className="space-y-3">
          {tasksByProject.slice(0, 5).map((task) => {
            const isOverdue = new Date(task.dueDate) < new Date();
            const projectLabel = task.projectNumber?.trim() || task.projectCode?.trim() || task.project;
            return (
              <Link key={task.id} to={`/app/task/${task.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{projectLabel} · {task.project} · {task.reportTemplate?.name ?? "Template"}</p>
                </div>
                <span className={cn("text-xs flex items-center gap-1 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
              </Link>
            );
          })}
          {tasksByProject.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No tasks found for selected project.</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}