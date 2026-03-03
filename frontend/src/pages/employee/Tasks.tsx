import { PageWrapper } from "@/components/PageWrapper";
import { Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { priorityConfig, statusConfig } from "@/lib/domain";

export default function EmployeeTasks() {
  const { data } = useQuery({ queryKey: ["tasks", "employee"], queryFn: () => api.getTasks({ limit: 100 }) });
  const myTasks = data?.items ?? [];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">My Tasks</h1>
        <p className="page-subtitle">Tasks assigned to you</p>
      </div>

      <div className="space-y-3">
        {myTasks.map((task, index) => {
          const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Link to={`/app/task/${task.id}`} className="flex items-center gap-4 p-4 glass-panel hover:border-primary/20 transition-all group">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{task.project} · {task.reportTemplate?.name ?? "Template"}</p>
                </div>
                <span className={cn("status-badge shrink-0", statusConfig[task.status].color)}>{statusConfig[task.status].label}</span>
                <span className={cn("status-badge shrink-0", priorityConfig[task.priority].color)}>{priorityConfig[task.priority].label}</span>
                <span className={cn("text-xs flex items-center gap-1 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </motion.div>
          );
        })}
        {myTasks.length === 0 && <div className="glass-panel p-12 text-center text-muted-foreground"><p>No tasks assigned to you yet.</p></div>}
      </div>
    </PageWrapper>
  );
}