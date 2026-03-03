import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { FolderKanban, ArrowRight, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { statusConfig } from "@/lib/domain";
import { toast } from "sonner";

export default function AdminProjects() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const { data: tasksData } = useQuery({ queryKey: ["tasks", "projects"], queryFn: () => api.getTasks({ limit: 200 }) });
  const { data: projects = [], refetch: refetchProjects } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });

  const tasks = tasksData?.items ?? [];

  const projectNames = useMemo(() => {
    const fromDb = projects.map((project) => project.name);
    const fromTasks = tasks.map((task) => task.project);
    return Array.from(new Set([...fromDb, ...fromTasks]));
  }, [projects, tasks]);

  const selectedProjectName = selectedProject ?? projectNames[0] ?? null;
  const selectedProjectInfo = selectedProjectName
    ? projects.find((project) => project.name === selectedProjectName)
    : undefined;
  const selectedProjectTasks = selectedProjectName
    ? tasks.filter((task) => task.project === selectedProjectName)
    : [];

  const selectedPeople = useMemo(() => {
    const map = new Map<string, string>();
    selectedProjectTasks.forEach((task) => {
      const key = task.assignedToId;
      const value = task.assignedTo?.name ?? "Unknown Employee";
      map.set(key, value);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [selectedProjectTasks]);

  const selectedDoneCount = selectedProjectTasks.filter((task) => task.status === "DONE").length;
  const selectedProgress = selectedProjectTasks.length ? Math.round((selectedDoneCount / selectedProjectTasks.length) * 100) : 0;

  const handleCreateProject = async () => {
    try {
      await api.createProject(form);
      await refetchProjects();
      setForm({ name: "", description: "" });
      setShowCreate(false);
      toast.success("Project added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add project";
      toast.error(message);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Active highway projects and sites</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {projectNames.map((project, index) => {
          const projectTasks = tasks.filter((task) => task.project === project);
          const done = projectTasks.filter((task) => task.status === "DONE").length;
          const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

          return (
            <motion.div
              key={project}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              onClick={() => setSelectedProject(project)}
              className={`glass-panel p-6 hover:border-primary/20 transition-all cursor-pointer group ${selectedProjectName === project ? "border-primary/40" : ""}`}
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

      {selectedProjectName && (
        <div className="glass-panel p-6 mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedProjectName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedProjectInfo?.description?.trim() ? selectedProjectInfo.description : "No description provided."}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {selectedProgress}% complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">People Involved</p>
              <p className="text-xl font-semibold mt-1">{selectedPeople.length}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">Total Tasks</p>
              <p className="text-xl font-semibold mt-1">{selectedProjectTasks.length}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">Completed Tasks</p>
              <p className="text-xl font-semibold mt-1">{selectedDoneCount}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${selectedProgress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Assigned Employees</p>
            {selectedPeople.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedPeople.map((person) => (
                  <span key={person.id} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-foreground border border-border/40">
                    {person.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No employees assigned yet.</p>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Task Details</p>
            {selectedProjectTasks.length ? (
              <div className="space-y-2">
                {selectedProjectTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned to: {task.assignedTo?.name ?? "Unknown Employee"}
                        </p>
                      </div>
                      <span className={`status-badge text-[10px] ${statusConfig[task.status].color}`}>{statusConfig[task.status].label}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks added for this project yet.</p>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Project</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary/50">
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
