import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { statusConfig } from "@/lib/domain";

export default function EmployeeTasks() {
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const { data } = useQuery({ queryKey: ["tasks", "employee"], queryFn: () => api.getTasks({ limit: 100 }) });
  const myTasks = data?.items ?? [];

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    myTasks.forEach((task) => {
      const label = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      if (label) projects.add(label);
    });
    return ["ALL", ...Array.from(projects).sort((a, b) => a.localeCompare(b))];
  }, [myTasks]);

  const visibleTasks = useMemo(() => {
    const filtered = myTasks.filter((task) => {
      if (selectedProject === "ALL") return true;
      const label = task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim();
      return label === selectedProject;
    });

    return [...filtered].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [myTasks, selectedProject]);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">My Tasks</h1>
        <p className="page-subtitle">Tasks assigned to you (sorted by due date)</p>
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
        {visibleTasks.map((task, index) => {
          const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";
          const projectLabel = task.projectNumber?.trim() || task.projectCode?.trim() || task.project;
          return (
            <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Link to={`/app/task/${task.id}`} className="flex items-center gap-4 p-4 glass-panel hover:border-primary/20 transition-all group">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{projectLabel} · {task.project} · {task.reportTemplate?.name ?? "Template"}</p>
                </div>
                <span className={cn("status-badge shrink-0", statusConfig[task.status].color)}>{statusConfig[task.status].label}</span>
                <span className={cn("text-xs flex items-center gap-1 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </motion.div>
          );
        })}
        {visibleTasks.length === 0 && <div className="glass-panel p-12 text-center text-muted-foreground"><p>No tasks found for selected project.</p></div>}
      </div>
    </PageWrapper>
  );
}