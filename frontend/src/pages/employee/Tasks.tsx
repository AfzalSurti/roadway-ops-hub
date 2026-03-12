import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Calendar, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { statusConfig } from "@/lib/domain";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export default function EmployeeTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const { data, refetch } = useQuery({ queryKey: ["tasks", "employee"], queryFn: () => api.getTasks({ limit: 100 }) });
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

    return [...filtered].sort((a, b) => {
      const aDone = a.status === "DONE" ? 1 : 0;
      const bDone = b.status === "DONE" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [myTasks, selectedProject]);

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedTaskId) ?? myTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, visibleTasks, myTasks]
  );

  useEffect(() => {
    const taskIdFromQuery = searchParams.get("taskId");
    if (taskIdFromQuery) {
      setSelectedTaskId(taskIdFromQuery);
    }
  }, [searchParams]);

  const { data: taskComments = [], refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", selectedTaskId],
    queryFn: () => api.getTaskComments(selectedTaskId as string),
    enabled: Boolean(selectedTaskId)
  });

  const managerComments = useMemo(
    () => taskComments.filter((comment) => comment.author?.role === "ADMIN"),
    [taskComments]
  );

  const handleComplete = async () => {
    if (!selectedTask) return;
    try {
      setSubmitting(true);
      await api.completeTask(selectedTask.id, completionNote.trim() || undefined);
      await Promise.all([refetch(), refetchComments()]);
      setCompletionNote("");
      toast.success("Task submitted to admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit task";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptComment = async () => {
    if (!selectedTask) return;
    try {
      setAcknowledging(true);
      await api.acknowledgeTaskComment(selectedTask.id);
      await refetch();
      toast.success("Comment accepted and sent back to admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept comment";
      toast.error(message);
    } finally {
      setAcknowledging(false);
    }
  };

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
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskId(task.id);
                  setSearchParams({ taskId: task.id });
                }}
                className="w-full text-left flex items-center gap-4 p-4 glass-panel hover:border-primary/20 transition-all group"
              >
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
              </button>
            </motion.div>
          );
        })}
        {visibleTasks.length === 0 && <div className="glass-panel p-12 text-center text-muted-foreground"><p>No tasks found for selected project.</p></div>}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => {
          setSelectedTaskId(null);
          setSearchParams({});
        }}>
          <div onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Task Details</h3>
              <button onClick={() => {
                setSelectedTaskId(null);
                setSearchParams({});
              }} className="p-1.5 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <p><span className="text-muted-foreground">Task:</span> {selectedTask.title}</p>
              <p><span className="text-muted-foreground">Project:</span> {selectedTask.project}</p>
              <p><span className="text-muted-foreground">Allocated:</span> {new Date(selectedTask.allocatedAt ?? selectedTask.createdAt).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Due:</span> {new Date(selectedTask.dueDate).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Status:</span> {statusConfig[selectedTask.status].label}</p>
              <p><span className="text-muted-foreground">Rating:</span> {selectedTask.rating ?? "-"}</p>
            </div>

            <p className="text-sm text-muted-foreground mb-2">Description</p>
            <p className="text-sm mb-4">{selectedTask.description || "-"}</p>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Admin Comments</p>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {managerComments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-border/40 p-2">
                    <p className="text-xs text-muted-foreground mb-1">{comment.author?.name ?? "Admin"} • {new Date(comment.createdAt).toLocaleString()}</p>
                    <p className="text-sm">{comment.body}</p>
                  </div>
                ))}
                {managerComments.length === 0 && <p className="text-xs text-muted-foreground">No admin comments.</p>}
              </div>
            </div>

            {selectedTask.status !== "DONE" && (
              <>
                <textarea
                  value={completionNote}
                  onChange={(event) => setCompletionNote(event.target.value)}
                  rows={3}
                  placeholder="Optional note while submitting task"
                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                />
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => void handleComplete()}
                    disabled={submitting}
                    className="py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Done (Send To Admin)"}
                  </button>
                  <button
                    onClick={() => void handleAcceptComment()}
                    disabled={acknowledging || managerComments.length === 0}
                    className="py-2.5 rounded-xl bg-secondary/70 border border-border/50 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    {acknowledging ? "Sending..." : "Accept Comment"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}