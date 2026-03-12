import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/lib/auth";
import { ListTodo, AlertTriangle, Star, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "employee-dashboard"], queryFn: () => api.getTasks({ limit: 100 }) });

  const myTasks = tasksData?.items ?? [];
  const pendingTasks = myTasks.filter((task) => task.status !== "DONE");
  const overdueTasks = myTasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "DONE");
  const ratedTasks = myTasks.filter((task) => typeof task.rating === "number");
  const avgRating = ratedTasks.length
    ? (ratedTasks.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / ratedTasks.length).toFixed(2)
    : "0.00";

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
    </PageWrapper>
  );
}