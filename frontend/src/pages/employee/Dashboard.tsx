import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/lib/auth";
import { ListTodo, AlertTriangle, CheckCircle2, Clock, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { priorityConfig } from "@/lib/domain";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "employee-dashboard"], queryFn: () => api.getTasks({ limit: 100 }) });
  const { data: reportsData } = useQuery({ queryKey: ["reports", "employee-dashboard"], queryFn: () => api.getReports({ limit: 100 }) });

  const myTasks = tasksData?.items ?? [];
  const myReports = reportsData?.items ?? [];
  const pendingTasks = myTasks.filter((task) => task.status !== "DONE");
  const overdueTasks = myTasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "DONE");

  const kpis = [
    { label: "My Tasks", value: myTasks.length, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: pendingTasks.length, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Overdue", value: overdueTasks.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Reports", value: myReports.length, icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" }
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
          <h3 className="font-semibold">Upcoming Tasks</h3>
          <Link to="/app/tasks" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {pendingTasks.slice(0, 5).map((task) => {
            const isOverdue = new Date(task.dueDate) < new Date();
            return (
              <Link key={task.id} to={`/app/task/${task.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.project} · {task.reportTemplate?.name ?? "Template"}</p>
                </div>
                <span className={cn("status-badge shrink-0", priorityConfig[task.priority].color)}>{priorityConfig[task.priority].label}</span>
                <span className={cn("text-xs flex items-center gap-1 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
              </Link>
            );
          })}
          {pendingTasks.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 mx-auto text-accent/50 mb-2" />
              <p className="text-sm text-muted-foreground">All caught up! No pending tasks.</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}