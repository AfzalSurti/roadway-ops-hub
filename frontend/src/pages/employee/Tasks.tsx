import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Calendar, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskItem } from "@/lib/domain";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { usePersistentState } from "@/hooks/use-persistent-state";

type EmployeeTaskStatus = "TODO" | "UNDER_REVIEW" | "IN_PROGRESS" | "DONE";

const employeeStatusConfig: Record<EmployeeTaskStatus, { label: string; color: string; hint: string }> = {
  TODO: { label: "To Do", color: "text-muted-foreground bg-muted", hint: "Task pending" },
  UNDER_REVIEW: { label: "Under Review", color: "text-warning bg-warning/10", hint: "Admin comment pending on task" },
  IN_PROGRESS: { label: "In Progress", color: "text-primary bg-primary/10", hint: "Compliance pending from employee" },
  DONE: { label: "Done", color: "text-accent bg-accent/10", hint: "Task completed" }
};

function getEmployeeTaskStatus(task: TaskItem): EmployeeTaskStatus {
  if (task.status === "DONE") return "DONE";
  if (task.status === "IN_PROGRESS") return "UNDER_REVIEW";
  if (task.status === "TODO" && !!task.managerReviewComments) return "IN_PROGRESS";
  return "TODO";
}

function getProjectLabel(task: TaskItem): string {
  return task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim() || "Unknown";
}

type EmployeeTaskAction = "SUBMIT" | "COMPLY" | null;

function getActionRequired(task: TaskItem): EmployeeTaskAction {
  const mapped = getEmployeeTaskStatus(task);
  if (mapped === "TODO") return "SUBMIT";
  if (mapped === "IN_PROGRESS") return "COMPLY";
  return null;
}

function getRatingDisplay(task: TaskItem): string {
  if (task.status === "DONE" && task.ratingEnabled && typeof task.rating === "number") {
    return String(task.rating);
  }
  return task.ratingEnabled ? "✓" : "✗";
}

export default function EmployeeTasks() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = usePersistentState<string>("employee.tasks.search", "");
  const [selectedProject, setSelectedProject] = usePersistentState<string>("employee.tasks.selectedProject", "ALL");
  const [selectedStatus, setSelectedStatus] = usePersistentState<"ALL" | EmployeeTaskStatus>("employee.tasks.selectedStatus", "ALL");
  const [fromDate, setFromDate] = usePersistentState<string>("employee.tasks.fromDate", () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = usePersistentState<string>("employee.tasks.toDate", () => new Date().toISOString().slice(0, 10));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const { data } = useQuery({ queryKey: ["tasks", "employee-shared"], queryFn: () => api.getTasks({ limit: 300 }) });
  const myTasks = data?.items ?? [];

  const patchTaskInCache = (updatedTask: TaskItem) => {
    queryClient.setQueryData<{ items: TaskItem[]; pagination: unknown }>(["tasks", "employee-shared"], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      };
    });
  };

  const projectOptions = useMemo(() => {
    const projects = new Set<string>();
    myTasks.forEach((task) => {
      const label = getProjectLabel(task);
      if (label) projects.add(label);
    });
    return ["ALL", ...Array.from(projects).sort((a, b) => a.localeCompare(b))];
  }, [myTasks]);

  const filteredTasks = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return myTasks.filter((task) => {
      const taskDate = new Date(task.allocatedAt ?? task.createdAt);
      const mapped = getEmployeeTaskStatus(task);
      const projectLabel = getProjectLabel(task);
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        projectLabel.toLowerCase().includes(search.toLowerCase());
      const matchesProject = selectedProject === "ALL" || projectLabel === selectedProject;
      const matchesStatus = selectedStatus === "ALL" || mapped === selectedStatus;
      const matchesFrom = !from || taskDate >= from;
      const matchesTo = !to || taskDate <= to;
      return matchesSearch && matchesProject && matchesStatus && matchesFrom && matchesTo;
    });
  }, [myTasks, search, selectedProject, selectedStatus, fromDate, toDate]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aDone = a.status === "DONE" ? 1 : 0;
      const bDone = b.status === "DONE" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredTasks]);

  const selectedTask = useMemo(
    () => sortedTasks.find((task) => task.id === selectedTaskId) ?? myTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, sortedTasks, myTasks]
  );

  useEffect(() => {
    const taskIdFromQuery = searchParams.get("taskId");
    if (taskIdFromQuery) setSelectedTaskId(taskIdFromQuery);
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

  const handleComplete = async (task: TaskItem) => {
    try {
      setSubmitting(true);
      const updated = await api.completeTask(task.id);
      patchTaskInCache(updated);
      await refetchComments();
      toast.success("Task submitted to admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit task";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptComment = async (task: TaskItem) => {
    try {
      setAcknowledging(true);
      const updated = await api.acknowledgeTaskComment(task.id);
      patchTaskInCache(updated);
      toast.success("Comment accepted and sent back to admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept comment";
      toast.error(message);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleActionRequired = async (task: TaskItem) => {
    const action = getActionRequired(task);
    if (action === "SUBMIT") {
      await handleComplete(task);
      return;
    }
    if (action === "COMPLY") {
      await handleAcceptComment(task);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header mb-0">
        <h1 className="page-title">My Tasks</h1>
      </div>

      <div className="text-xs text-muted-foreground mt-2 mb-4 flex flex-wrap gap-x-4 gap-y-1">
        <span>To Do: Task pending</span>
        <span>Under Review: Admin comment pending on task</span>
        <span>In Progress: Compliance pending from employee</span>
        <span>Done: Task completed</span>
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

        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value as "ALL" | EmployeeTaskStatus)}
          title="Select status"
          aria-label="Select status"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm min-w-[200px]"
        >
          <option value="ALL">All Status</option>
          {(Object.keys(employeeStatusConfig) as EmployeeTaskStatus[]).map((status) => (
            <option key={status} value={status}>{employeeStatusConfig[status].label}</option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(event) => {
            const next = event.target.value;
            setFromDate(next);
            if (toDate && next && toDate < next) setToDate(next);
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
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-sm min-w-[1300px]">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="text-left p-4 font-medium">Project</th>
              <th className="text-left p-4 font-medium">Task</th>
              <th className="text-left p-4 font-medium">Rating</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Allocated Date</th>
              <th className="text-left p-4 font-medium">Task Duration</th>
              <th className="text-left p-4 font-medium">Due Date</th>
              <th className="text-left p-4 font-medium">Action Required</th>
              <th className="text-left p-4 font-medium">Completed At</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const mappedStatus = getEmployeeTaskStatus(task);
              const actionRequired = getActionRequired(task);
              const actionBusy = (actionRequired === "SUBMIT" && submitting) || (actionRequired === "COMPLY" && acknowledging);
              return (
                <tr
                  key={task.id}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setSearchParams({ taskId: task.id });
                  }}
                  className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="p-4 text-muted-foreground">{getProjectLabel(task)}</td>
                  <td className="p-4 min-w-[320px]">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description || "-"}</p>
                  </td>
                  <td className="p-4 font-semibold">{getRatingDisplay(task)}</td>
                  <td className="p-4">
                    <span className={cn("status-badge", employeeStatusConfig[mappedStatus].color)}>
                      {employeeStatusConfig[mappedStatus].label}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(task.allocatedAt ?? task.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-muted-foreground">{task.allottedDays ?? "-"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(task.dueDate).toLocaleDateString()}</td>
                  <td className="p-4" onClick={(event) => event.stopPropagation()}>
                    {actionRequired ? (
                      <button
                        onClick={() => void handleActionRequired(task)}
                        disabled={actionBusy}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                      >
                        {actionBusy ? "Processing..." : actionRequired === "SUBMIT" ? "Submit" : "Comply"}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground">{task.reviewCompletedAt ? new Date(task.reviewCompletedAt).toLocaleDateString() : "-"}</td>
                </tr>
              );
            })}
            {sortedTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-muted-foreground">No tasks found for selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => {
            setSelectedTaskId(null);
            setSearchParams({});
          }}
        >
          <div onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Task Details</h3>
              <button
                onClick={() => {
                  setSelectedTaskId(null);
                  setSearchParams({});
                }}
                className="p-1.5 rounded-lg hover:bg-secondary/50"
                title="Close"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
              <p><span className="text-muted-foreground">Task:</span> {selectedTask.title}</p>
              <p><span className="text-muted-foreground">Project:</span> {getProjectLabel(selectedTask)}</p>
              <p><span className="text-muted-foreground">Rating:</span> {getRatingDisplay(selectedTask)}</p>
              <p><span className="text-muted-foreground">Allocated:</span> {new Date(selectedTask.allocatedAt ?? selectedTask.createdAt).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Task Duration:</span> {selectedTask.allottedDays ?? "-"} day(s)</p>
              <p><span className="text-muted-foreground">Due:</span> {new Date(selectedTask.dueDate).toLocaleDateString()}</p>
              <p><span className="text-muted-foreground">Status:</span> {employeeStatusConfig[getEmployeeTaskStatus(selectedTask)].label}</p>
              <p><span className="text-muted-foreground">Completed At:</span> {selectedTask.reviewCompletedAt ? new Date(selectedTask.reviewCompletedAt).toLocaleDateString() : "-"}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Action Required:</span> {getActionRequired(selectedTask) === "SUBMIT" ? "Submit" : getActionRequired(selectedTask) === "COMPLY" ? "Comply" : "-"}</p>
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

            {getActionRequired(selectedTask) && (
              <div className="mt-3">
                <button
                  onClick={() => void handleActionRequired(selectedTask)}
                  disabled={(getActionRequired(selectedTask) === "SUBMIT" && submitting) || (getActionRequired(selectedTask) === "COMPLY" && acknowledging)}
                  className="py-2.5 px-4 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 disabled:opacity-50"
                >
                  {(getActionRequired(selectedTask) === "SUBMIT" && submitting) || (getActionRequired(selectedTask) === "COMPLY" && acknowledging)
                    ? "Processing..."
                    : getActionRequired(selectedTask) === "SUBMIT"
                    ? "Submit"
                    : "Comply"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}