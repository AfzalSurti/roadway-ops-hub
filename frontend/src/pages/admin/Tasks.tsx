import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, List, Search, Calendar, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { TaskItem } from "@/lib/domain";
import { toAvatarUrl } from "@/lib/domain";
import { toast } from "sonner";

type AdminTaskStatus = "TODO" | "UNDER_REVIEW" | "IN_PROGRESS" | "DONE";

const adminStatusConfig: Record<AdminTaskStatus, { label: string; color: string }> = {
  TODO: { label: "To Do", color: "text-muted-foreground bg-muted" },
  UNDER_REVIEW: { label: "Under Review", color: "text-warning bg-warning/10" },
  IN_PROGRESS: { label: "In Progress", color: "text-primary bg-primary/10" },
  DONE: { label: "Done", color: "text-accent bg-accent/10" }
};

function getAdminTaskStatus(task: TaskItem): AdminTaskStatus {
  if (task.status === "DONE") return "DONE";
  if (task.status === "IN_PROGRESS") return "UNDER_REVIEW";
  if (task.status === "TODO" && !!task.managerReviewComments) return "IN_PROGRESS";
  return "TODO";
}

const columns = [
  { key: "TODO", label: "To Do" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE", label: "Done" }
] as const;

export default function AdminTasks() {
  const [view, setView] = useState<"kanban" | "list">("list");
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedAssignedToId, setSelectedAssignedToId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | AdminTaskStatus>("ALL");
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editAssignedToId, setEditAssignedToId] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const { data: users = [] } = useQuery({ queryKey: ["users", "task-edit"], queryFn: () => api.getUsers() });
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

  useEffect(() => {
    if (!selectedTask) {
      setIsEditingTask(false);
      return;
    }
    setEditTitle(selectedTask.title);
    setEditProject(selectedTask.project);
    setEditAssignedToId(selectedTask.assignedToId);
    setIsEditingTask(false);
  }, [selectedTask]);

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    if (!editTitle.trim() || !editProject.trim() || !editAssignedToId) {
      toast.error("Please fill required task fields");
      return;
    }

    try {
      const updated = await api.updateTask(selectedTask.id, {
        title: editTitle.trim(),
        project: editProject.trim(),
        assignedToId: editAssignedToId
      });
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
      setSelectedTask(updated);
      setIsEditingTask(false);
      toast.success("Task updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      toast.error(message);
    }
  };

  const handleApproveTask = async () => {
    if (!selectedTask) return;
    try {
      setReviewing(true);
      const updated = await api.approveTask(selectedTask.id);
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
      setSelectedTask(updated);
      toast.success("Task approved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve task";
      toast.error(message);
    } finally {
      setReviewing(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedTask || !reviewComment.trim()) {
      toast.error("Please add a comment");
      return;
    }
    try {
      setReviewing(true);
      const updated = await api.requestTaskChanges(selectedTask.id, reviewComment.trim());
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
      setSelectedTask(updated);
      setReviewComment("");
      toast.success("Comment sent to employee");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to request changes";
      toast.error(message);
    } finally {
      setReviewing(false);
    }
  };

  const projectOptions = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((task) => {
      if (task.project?.trim()) set.add(task.project.trim());
    });
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [tasks]);

  const employeeOptions = useMemo(() => {
    return users
      .filter((user) => user.role === "EMPLOYEE")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.project.toLowerCase().includes(search.toLowerCase());
      const matchesProject = selectedProject === "ALL" || task.project === selectedProject;
      const matchesAssignedTo = selectedAssignedToId === "ALL" || task.assignedToId === selectedAssignedToId;
      const taskStatus = getAdminTaskStatus(task);
      const matchesStatus = selectedStatus === "ALL" || taskStatus === selectedStatus;
      const allocatedDate = new Date(task.allocatedAt ?? task.createdAt);
      const matchesFrom = !from || allocatedDate >= from;
      const matchesTo = !to || allocatedDate <= to;
      return matchesSearch && matchesProject && matchesAssignedTo && matchesStatus && matchesFrom && matchesTo;
    });
  }, [tasks, search, selectedProject, selectedAssignedToId, selectedStatus, fromDate, toDate]);

  const sortedTasks = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDone = a.status === "DONE" ? 1 : 0;
      const bDone = b.status === "DONE" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filtered]);

  const projectBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    sortedTasks.forEach((task) => {
      const key = task.project?.trim() || "Uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([project, count]) => ({ project, count }))
      .sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));
  }, [sortedTasks]);

  const monthBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    sortedTasks.forEach((task) => {
      const date = new Date(task.allocatedAt ?? task.createdAt);
      const key = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const da = new Date(a.month).getTime();
        const db = new Date(b.month).getTime();
        return db - da;
      });
  }, [sortedTasks]);

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
        <select
          value={selectedAssignedToId}
          onChange={(event) => setSelectedAssignedToId(event.target.value)}
          title="Select employee"
          aria-label="Select employee"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm min-w-[220px]"
        >
          <option value="ALL">All Employees</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value as "ALL" | AdminTaskStatus)}
          title="Select status"
          aria-label="Select status"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm min-w-[180px]"
        >
          <option value="ALL">All Status</option>
          {columns.map((column) => (
            <option key={column.key} value={column.key}>{column.label}</option>
          ))}
        </select>
        <select
          value={selectedProject}
          onChange={(event) => setSelectedProject(event.target.value)}
          title="Select project"
          aria-label="Select project"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm min-w-[220px]"
        >
          {projectOptions.map((project) => (
            <option key={project} value={project}>
              {project === "ALL" ? "All Projects" : project}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(event) => {
            const next = event.target.value;
            setFromDate(next);
            if (toDate && next && toDate < next) {
              setToDate(next);
            }
          }}
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          title="From date"
          aria-label="From date"
        />
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(event) => setToDate(event.target.value)}
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          title="To date"
          aria-label="To date"
        />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold">Project-wise Task Count</h3>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {projectBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No task data available.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left p-3 font-medium">Project</th>
                    <th className="text-left p-3 font-medium">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {projectBreakdown.map((row) => (
                    <tr key={row.project} className="border-b border-border/20 last:border-b-0">
                      <td className="p-3">{row.project}</td>
                      <td className="p-3 font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold">Month-wise Tasks Given</h3>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {monthBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No task data available.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-left p-3 font-medium">Tasks Given</th>
                  </tr>
                </thead>
                <tbody>
                  {monthBreakdown.map((row) => (
                    <tr key={row.month} className="border-b border-border/20 last:border-b-0">
                      <td className="p-3">{row.month}</td>
                      <td className="p-3 font-medium">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-8 text-sm text-muted-foreground">Loading tasks…</div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = sortedTasks.filter((task) => getAdminTaskStatus(task) === column.key);
            const cfg = adminStatusConfig[column.key];
            return (
              <div key={column.key} className="kanban-column min-w-[280px]">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`status-badge ${cfg.color}`}>{column.label}</span>
                  <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {columnTasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} onOpen={() => setSelectedTask(task)} />
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
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Project</th>
                <th className="text-left p-4 font-medium">Task</th>
                <th className="text-left p-4 font-medium">Rating Enabled</th>
                <th className="text-left p-4 font-medium">Rating</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Assigned To</th>
                <th className="text-left p-4 font-medium">Assigned Date</th>
                <th className="text-left p-4 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => (
                <tr key={task.id} onClick={() => setSelectedTask(task)} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="p-4 text-muted-foreground">{task.project}</td>
                  <td className="p-4 min-w-[320px]">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description || "-"}</p>
                  </td>
                  <td className="p-4">
                    {task.ratingEnabled ? (
                      <span className="inline-flex items-center text-accent" title="Yes" aria-label="Yes">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-destructive" title="No" aria-label="No">
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {task.status === "DONE" && task.ratingEnabled ? (
                      <span className="font-semibold text-accent">{task.rating ?? "-"}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const mappedStatus = getAdminTaskStatus(task);
                      return <span className={`status-badge ${adminStatusConfig[mappedStatus].color}`}>{adminStatusConfig[mappedStatus].label}</span>;
                    })()}
                  </td>
                  <td className="p-4 text-muted-foreground">{task.assignedTo?.name ?? "-"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(task.allocatedAt ?? task.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-muted-foreground">{new Date(task.dueDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
          <div onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-lg font-semibold">Task Details</h3>
              <div className="flex items-center gap-2">
                {isEditingTask ? (
                  <>
                    <button
                      onClick={() => setIsEditingTask(false)}
                      className="px-3 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSaveTask()}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditingTask(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20"
                  >
                    Edit Task
                  </button>
                )}
              </div>
            </div>

            {isEditingTask ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Task</label>
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    title="Task"
                    aria-label="Task"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Project</label>
                  <input
                    value={editProject}
                    onChange={(event) => setEditProject(event.target.value)}
                    title="Project"
                    aria-label="Project"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Assigned To</label>
                  <select
                    value={editAssignedToId}
                    onChange={(event) => setEditAssignedToId(event.target.value)}
                    title="Assigned To"
                    aria-label="Assigned To"
                    className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 outline-none"
                  >
                    <option value="">Select employee</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <p><span className="text-muted-foreground">Task:</span> {selectedTask.title}</p>
                <p><span className="text-muted-foreground">Allocated:</span> {new Date(selectedTask.allocatedAt ?? selectedTask.createdAt).toLocaleDateString()}</p>
                <p><span className="text-muted-foreground">Status:</span> {adminStatusConfig[getAdminTaskStatus(selectedTask)].label}</p>
                <p><span className="text-muted-foreground">Submission Days:</span> {selectedTask.allottedDays ?? "-"}</p>
                <p><span className="text-muted-foreground">Submitted At:</span> {selectedTask.submittedForReviewAt ? new Date(selectedTask.submittedForReviewAt).toLocaleDateString() : "-"}</p>
                <p><span className="text-muted-foreground">Completed At:</span> {selectedTask.actualCompletedAt ? new Date(selectedTask.actualCompletedAt).toLocaleDateString() : "-"}</p>
                <p><span className="text-muted-foreground">Rating:</span> {selectedTask.rating ?? "-"}</p>
              </div>
            )}
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

            {selectedTask.status !== "DONE" && (
              <div className="mt-4 border-t border-border/40 pt-4">
                <p className="text-sm font-medium mb-2">Admin Review</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => void handleApproveTask()}
                    disabled={reviewing}
                    className="py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                  >
                    {reviewing ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => void handleRequestChanges()}
                    disabled={reviewing || !reviewComment.trim()}
                    className="py-2.5 rounded-xl bg-secondary/70 border border-border/50 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    Add Comment
                  </button>
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                  placeholder="Write comment for employee"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function TaskCard({ task, index, onOpen }: { task: TaskItem; index: number; onOpen: () => void }) {
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onOpen}
      className="task-card cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="text-sm font-medium leading-snug">{task.title}</h4>
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