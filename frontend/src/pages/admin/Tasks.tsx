import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, List, Search, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { TaskItem, TaskStatus } from "@/lib/domain";
import { priorityConfig, statusConfig, toAvatarUrl } from "@/lib/domain";
import { toast } from "sonner";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To Do" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "BLOCKED", label: "Blocked" },
  { status: "DONE", label: "Done" }
];

export default function AdminTasks() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const { data: selectedTaskComments = [] } = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: () => api.getTaskComments(selectedTask!.id),
    enabled: Boolean(selectedTask?.id)
  });
  const completionNote = useMemo(() => {
    if (!selectedTask) {
      return null;
    }

    const employeeComments = selectedTaskComments.filter((comment) => comment.author?.role === "EMPLOYEE");
    if (!employeeComments.length) {
      return null;
    }

    // Treat the latest employee comment as completion note (submitted with task complete action).
    return employeeComments[employeeComments.length - 1];
  }, [selectedTask, selectedTaskComments]);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await api.getTasks({ limit: 100, search: search || undefined });
        setTasks(result.items);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load tasks";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [search]);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          task.project.toLowerCase().includes(search.toLowerCase())
      ),
    [tasks, search]
  );

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage and track all assignments</p>
        </div>
        <Link
          to="/admin/tasks/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm flex-1 max-w-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground w-full"
          />
        </div>
        <div className="flex items-center rounded-xl bg-secondary/50 border border-border/50 p-1">
          <button
            onClick={() => setView("kanban")}
            title="Kanban view"
            aria-label="Kanban view"
            className={cn("p-2 rounded-lg transition-colors", view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            title="List view"
            aria-label="List view"
            className={cn("p-2 rounded-lg transition-colors", view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-8 text-sm text-muted-foreground">Loading tasks…</div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = filtered.filter((task) => task.status === column.status);
            const cfg = statusConfig[column.status];
            return (
              <div key={column.status} className="kanban-column min-w-[280px]">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`status-badge ${cfg.color}`}>{column.label}</span>
                  <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {columnTasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Task</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Project</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Assigned</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Priority</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id} onClick={() => setSelectedTask(task)} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="p-4">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.reportTemplate?.name ?? "Template"}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{task.project}</td>
                  <td className="p-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <img src={toAvatarUrl(task.assignedTo?.name ?? "User")} alt="" className="w-6 h-6 rounded-full" />
                      <span className="text-muted-foreground">{task.assignedTo?.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`status-badge ${statusConfig[task.status].color}`}>{statusConfig[task.status].label}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`status-badge ${priorityConfig[task.priority].color}`}>{priorityConfig[task.priority].label}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-muted-foreground">{new Date(task.allocatedAt ?? task.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Task Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <p><span className="text-muted-foreground">Task:</span> {selectedTask.title}</p>
              <p><span className="text-muted-foreground">Allocated:</span> {new Date(selectedTask.allocatedAt ?? selectedTask.createdAt).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Submission Days:</span> {selectedTask.allottedDays ?? "-"}</p>
              <p><span className="text-muted-foreground">Submitted At:</span> {selectedTask.submittedForReviewAt ? new Date(selectedTask.submittedForReviewAt).toLocaleDateString() : "-"}</p>
              <p><span className="text-muted-foreground">Completed At:</span> {selectedTask.actualCompletedAt ? new Date(selectedTask.actualCompletedAt).toLocaleDateString() : "-"}</p>
              <p><span className="text-muted-foreground">Rating:</span> {selectedTask.rating ?? "-"}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-2">Description</p>
            <p className="text-sm mb-4">{selectedTask.description}</p>

            {completionNote && (
              <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-3">
                <p className="text-xs font-semibold text-accent mb-1">Completion Note</p>
                <p className="text-sm">{completionNote.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {completionNote.author?.name ?? "Employee"} • {new Date(completionNote.createdAt).toLocaleString()}
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-2">Messages</p>
            <div className="space-y-2">
              {selectedTaskComments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{comment.author?.name ?? "User"} • {new Date(comment.createdAt).toLocaleString()}</p>
                  <p className="text-sm">{comment.body}</p>
                </div>
              ))}
              {selectedTaskComments.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function TaskCard({ task, index }: { task: TaskItem; index: number }) {
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="task-card"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-sm font-medium leading-snug">{task.title}</h4>
        <span className={`status-badge text-[10px] shrink-0 ${priorityConfig[task.priority].color}`}>
          {priorityConfig[task.priority].label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{task.project}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={toAvatarUrl(task.assignedTo?.name ?? "User")} alt="" className="w-5 h-5 rounded-full" />
          <span className="text-xs text-muted-foreground">{task.assignedTo?.name?.split(" ")[0] ?? "—"}</span>
        </div>
        <span className={cn("text-xs flex items-center gap-1", isOverdue ? "text-destructive" : "text-muted-foreground")}>
          <Calendar className="h-3 w-3" />
          {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="mt-2">
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{task.reportTemplate?.name ?? "Template"}</span>
      </div>
    </motion.div>
  );
}