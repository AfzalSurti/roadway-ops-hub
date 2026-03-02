import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { tasks, users, templates, reportTypeLabels, statusConfig, priorityConfig } from "@/lib/mock-data";
import { ArrowLeft, Calendar, Upload, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const task = tasks.find((t) => t.id === id);
  const assignee = users.find((u) => u.id === task?.assignedTo);
  const template = templates.find((t) => t.reportType === task?.reportType);
  const [showSubmit, setShowSubmit] = useState(false);

  if (!task) {
    return (
      <PageWrapper>
        <p className="text-muted-foreground">Task not found.</p>
      </PageWrapper>
    );
  }

  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "done";

  const handleStatusUpdate = (action: string) => {
    toast.success(`Task marked as ${action}`);
    toast("Saved locally (demo)", { description: "Offline mode simulation" });
  };

  return (
    <PageWrapper>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={cn("status-badge", statusConfig[task.status].color)}>{statusConfig[task.status].label}</span>
              <span className={cn("status-badge", priorityConfig[task.priority].color)}>{priorityConfig[task.priority].label}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{reportTypeLabels[task.reportType]}</span>
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
                  <img src={assignee?.avatar} alt="" className="w-6 h-6 rounded-full" />
                  <span className="text-sm font-medium">{assignee?.name}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Status Actions */}
          <div className="glass-panel p-6">
            <h3 className="font-semibold mb-4">Update Status</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => handleStatusUpdate("started")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 transition-colors">
                <Play className="h-4 w-4" />Start Task
              </button>
              <button onClick={() => handleStatusUpdate("blocked")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20 text-sm font-medium hover:bg-warning/20 transition-colors">
                <AlertTriangle className="h-4 w-4" />Mark Blocked
              </button>
              <button onClick={() => handleStatusUpdate("done")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-medium hover:bg-accent/20 transition-colors">
                <CheckCircle2 className="h-4 w-4" />Mark Done
              </button>
            </div>
          </div>

          {/* Report Submission */}
          {!showSubmit ? (
            <button
              onClick={() => setShowSubmit(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Submit Report
            </button>
          ) : template && (
            <div className="glass-panel p-6">
              <h3 className="font-semibold mb-4">Submit Report — {template.name}</h3>
              <div className="space-y-4">
                {template.fields.map((field) => (
                  <div key={field.id}>
                    <label className="text-sm font-medium mb-1.5 block">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50" rows={3} />
                    ) : field.type === "select" ? (
                      <select className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50">
                        <option value="">Select…</option>
                        {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === "photo" || field.type === "file" ? (
                      <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-primary/30 transition-colors cursor-pointer">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">{field.type === "photo" ? "Upload photos" : "Upload file"}</p>
                      </div>
                    ) : field.type === "checkbox" ? (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded" /> Yes</label>
                    ) : (
                      <input type={field.type} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50" />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => { toast.success("Report submitted!"); toast("Saved locally (demo)"); setShowSubmit(false); }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                >
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-panel p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Report Type</p>
            <p className="font-medium text-sm">{reportTypeLabels[task.reportType]}</p>
          </div>
          <div className="glass-panel p-4">
            <p className="text-xs text-muted-foreground mb-2">Template Fields</p>
            {template?.fields.map((f) => (
              <div key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                <span className="text-muted-foreground">{f.label}</span>
                {f.required && <span className="text-[10px] text-destructive">*</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
