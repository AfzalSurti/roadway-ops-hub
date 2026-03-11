import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function AdminProjects() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", "projects-summary"],
    queryFn: () => api.getTasks({ limit: 500 })
  });
  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const tasks = tasksData?.items ?? [];

  const projectRows = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project === project.name);
      const totalTasks = projectTasks.length;
      const pendingTasks = projectTasks.filter((task) => task.status !== "DONE").length;
      const overdueTasks = projectTasks.filter((task) => task.status !== "DONE" && new Date(task.dueDate) < new Date()).length;

      return {
        id: project.id,
        projectName: project.name,
        totalTasks,
        pendingTasks,
        overdueTasks
      };
    });
  }, [projects, tasks]);

  const handleCreateProject = async () => {
    if (!form.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      await api.createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined
      });
      await Promise.all([refetchProjects(), refetchTasks()]);
      setForm({ name: "", description: "" });
      setShowCreate(false);
      toast.success("Project added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add project";
      toast.error(message);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    const shouldDelete = window.confirm(`Delete project \"${name}\"?`);
    if (!shouldDelete) return;

    try {
      setDeletingId(id);
      await api.deleteProject(id);
      await Promise.all([refetchProjects(), refetchTasks()]);
      toast.success("Project deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Project-wise task status summary</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Project Name</th>
                <th className="text-left p-4 font-medium">Total Tasks</th>
                <th className="text-left p-4 font-medium">Pending</th>
                <th className="text-left p-4 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {projectRows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="border-b border-border/30"
                >
                  <td className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.projectName}</span>
                      <button
                        onClick={() => void handleDeleteProject(row.id, row.projectName)}
                        disabled={deletingId === row.id}
                        className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        title="Delete project"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-medium">{row.totalTasks}</td>
                  <td className="p-4 font-medium">{row.pendingTasks}</td>
                  <td className="p-4 font-medium">{row.overdueTasks}</td>
                </motion.tr>
              ))}
              {projectRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-muted-foreground">No projects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Project</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Project name"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                placeholder="Project description (optional)"
              />
              <button
                onClick={() => void handleCreateProject()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Create Project
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
