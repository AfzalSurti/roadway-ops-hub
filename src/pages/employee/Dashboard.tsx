import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { tasks, reports, reportTypeLabels, statusConfig, priorityConfig } from "@/lib/mock-data";
import { ListTodo, AlertTriangle, CheckCircle2, Clock, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const myTasks = tasks.filter((t) => t.assignedTo === user?.id);
  const myReports = reports.filter((r) => r.submittedBy === user?.id);
  const pendingTasks = myTasks.filter((t) => t.status !== "done");
  const overdueTasks = myTasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== "done");

  const kpis = [
    { label: "My Tasks", value: myTasks.length, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: pendingTasks.length, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Overdue", value: overdueTasks.length, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Completed", value: myTasks.filter((t) => t.status === "done").length, icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" },
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="page-subtitle">Here's your task overview</p>
      </div>

      {/* KPIs */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={item} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${kpi.bg} w-fit mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Upcoming Tasks */}
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
              <Link
                key={task.id}
                to={`/app/task/${task.id}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.project} · {reportTypeLabels[task.reportType]}</p>
                </div>
                <span className={cn("status-badge shrink-0", priorityConfig[task.priority].color)}>
                  {priorityConfig[task.priority].label}
                </span>
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
