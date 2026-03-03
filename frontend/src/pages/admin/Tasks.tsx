import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, List, Search, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
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
            className={cn("p-2 rounded-lg transition-colors", view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
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
                <tr key={task.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
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
                  <td className="p-4 hidden lg:table-cell text-muted-foreground">{new Date(task.dueDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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