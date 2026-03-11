import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { statusConfig, toAvatarUrl } from "@/lib/domain";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [completionNote, setCompletionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const {
    data: task,
    isLoading: isTaskLoading,
    isError: isTaskError,
    error: taskError
  } = useQuery({
    queryKey: ["task", id],
    queryFn: () => api.getTask(id as string),
    enabled: Boolean(id),
    retry: 1
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", id],
    queryFn: () => api.getTaskComments(id as string),
    enabled: Boolean(id)
  });

  if (!id) {
    return (
      <PageWrapper>
        <p className="text-muted-foreground">Invalid task link.</p>
      </PageWrapper>
    );
  }

  if (isTaskLoading) {
    return (
      <PageWrapper>
        <p className="text-muted-foreground">Loading task...</p>
      </PageWrapper>
    );
  }

  if (isTaskError) {
    const message = taskError instanceof Error ? taskError.message : "Failed to load task.";
    return (
      <PageWrapper>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <p className="text-muted-foreground">{message}</p>
      </PageWrapper>
    );
  }

  if (!task) {
    return (
      <PageWrapper>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <p className="text-muted-foreground">Task not found.</p>
      </PageWrapper>
    );
  }

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";

  const managerComments = useMemo(
    () => comments.filter((comment) => comment.author?.role === "ADMIN"),
    [comments]
  );

  const handleCompleteTask = async () => {
    try {
      setSubmitting(true);
      await api.completeTask(task.id, completionNote.trim() || undefined);
      if (managerComments.length > 0) {
        await api.acknowledgeTaskComment(task.id);
      }
      toast.success("Task marked as completed");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete task";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledgeComment = async () => {
    try {
      setAcknowledging(true);
      await api.acknowledgeTaskComment(task.id);
      toast.success("Comment acknowledgement sent to admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to acknowledge comment";
      toast.error(message);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <PageWrapper>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={cn("status-badge", statusConfig[task.status].color)}>{statusConfig[task.status].label}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{task.reportTemplate?.name ?? "Template"}</span>
            </div>
            <h1 className="text-xl font-bold mb-2">{task.title}</h1>
            <p className="text-muted-foreground">{task.description}</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p className="text-xs text-muted-foreground">Project</p>
                <p className="text-sm font-medium">{task.project}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className={cn("text-sm font-medium flex items-center gap-1", isOverdue && "text-destructive")}>
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <div className="flex items-center gap-2 mt-1">
                  <img src={toAvatarUrl(task.assignedTo?.name ?? "User")} alt="" className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-medium">{task.assignedTo?.name ?? "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Allocated At</p>
                <p className="text-sm font-medium">{new Date(task.allocatedAt ?? task.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Submission Period</p>
                <p className="text-sm font-medium">{task.allottedDays ?? "-"} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Days Taken</p>
                <p className="text-sm font-medium">{task.completionDays ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delay (Days)</p>
                <p className="text-sm font-medium">{task.completionDelayDays ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-sm font-medium">{task.rating ?? "-"}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4">Task Completion</h3>
            <textarea
              value={completionNote}
              onChange={(event) => setCompletionNote(event.target.value)}
              rows={3}
              placeholder="Add optional completion note"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
            />
            <button
              onClick={() => void handleCompleteTask()}
              disabled={submitting || task.status === "DONE"}
              className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Updating..." : task.status === "DONE" ? "Task Completed" : "Task Completed"}
            </button>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4">Manager Comments</h3>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
              {managerComments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">{comment.author?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{comment.body}</p>
                </div>
              ))}
              {managerComments.length === 0 && <p className="text-sm text-muted-foreground">No manager comments yet.</p>}
            </div>
            <button
              onClick={() => void handleAcknowledgeComment()}
              disabled={acknowledging || managerComments.length === 0}
              className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {acknowledging ? "Sending..." : "OK (Comment Compliant)"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Notifications</p>
            <p className="font-medium text-sm">Check bell icon for full status updates</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}