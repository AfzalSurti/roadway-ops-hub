import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { FolderKanban, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { statusConfig } from "@/lib/domain";

export default function AdminProjects() {
  const { data } = useQuery({ queryKey: ["tasks", "projects"], queryFn: () => api.getTasks({ limit: 200 }) });
  const tasks = data?.items ?? [];
  const projects = Array.from(new Set(tasks.map((task) => task.project)));

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <p className="page-subtitle">Active highway projects and sites</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projects.map((project, index) => {
          const projectTasks = tasks.filter((task) => task.project === project);
          const done = projectTasks.filter((task) => task.status === "DONE").length;
          const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

          return (
            <motion.div
              key={project}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="glass-panel p-6 hover:border-primary/20 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold mb-1">{project}</h3>
              <p className="text-sm text-muted-foreground mb-4">{projectTasks.length} tasks</p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono">{progress}%</span>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const).map((status) => {
                  const count = projectTasks.filter((task) => task.status === status).length;
                  if (!count) return null;
                  return (
                    <span key={status} className={`status-badge text-[10px] ${statusConfig[status].color}`}>
                      {statusConfig[status].label}: {count}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </PageWrapper>
  );
}