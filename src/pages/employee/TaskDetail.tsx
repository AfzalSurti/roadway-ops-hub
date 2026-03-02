import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ArrowLeft, Calendar, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { priorityConfig, statusConfig, toAvatarUrl } from "@/lib/domain";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: task } = useQuery({
    queryKey: ["task", id],
    queryFn: () => api.getTask(id as string),
    enabled: Boolean(id)
  });

  const templateFields = useMemo(() => task?.reportTemplate?.fields ?? [], [task]);

  if (!task) {
    return (
      <PageWrapper>
        <p className="text-muted-foreground">Task not found.</p>
      </PageWrapper>
    );
  }

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "DONE";

  const handleStatusUpdate = async (status: "IN_PROGRESS" | "BLOCKED" | "DONE") => {
    try {
      await api.updateTask(task.id, { status });
      toast.success(`Task updated to ${status.replace("_", " ")}`);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update task";
      toast.error(message);
    }
  };

  const handleSubmitReport = async () => {
    try {
      setSubmitting(true);
      await api.submitReport({
        taskId: task.id,
        reportTemplateId: task.reportTemplateId,
        submission
      });
      toast.success("Report submitted!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit report";
      toast.error(message);
    } finally {
      setSubmitting(false);
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
              <span className={cn("status-badge", priorityConfig[task.priority].color)}>{priorityConfig[task.priority].label}</span>
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
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4">Update Status</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void handleStatusUpdate("IN_PROGRESS")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 transition-colors">
                <Play className="h-4 w-4" />Start Task
              </button>
              <button onClick={() => void handleStatusUpdate("BLOCKED")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-medium hover:bg-warning/20 transition-colors">
                <AlertTriangle className="h-4 w-4" />Mark Blocked
              </button>
              <button onClick={() => void handleStatusUpdate("DONE")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors">
                <CheckCircle2 className="h-4 w-4" />Mark Done
              </button>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4">Submit Report — {task.reportTemplate?.name ?? "Template"}</h3>
            <div className="space-y-4">
              {templateFields.map((field) => (
                <div key={field.id}>
                  <label className="text-sm font-medium mb-1.5 block">{field.label} {field.required && <span className="text-destructive">*</span>}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      onChange={(event) => setSubmission((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                    />
                  ) : field.type === "select" ? (
                    <select
                      onChange={(event) => setSubmission((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                    >
                      <option value="">Select…</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" onChange={(event) => setSubmission((prev) => ({ ...prev, [field.id]: event.target.checked }))} className="rounded" /> Yes
                    </label>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      onChange={(event) => setSubmission((prev) => ({ ...prev, [field.id]: event.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() => void handleSubmitReport()}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Report Type</p>
            <p className="font-medium text-sm">{task.reportTemplate?.name ?? "Template"}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs text-muted-foreground mb-2">Template Fields</p>
            {templateFields.map((field) => (
              <div key={field.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                <span className="text-muted-foreground">{field.label}</span>
                {field.required && <span className="text-[10px] text-destructive">*</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}