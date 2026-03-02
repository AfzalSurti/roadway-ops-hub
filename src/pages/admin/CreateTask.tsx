import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { users, templates, projects, reportTypeLabels, type Priority } from "@/lib/mock-data";
import { ArrowLeft, Upload, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const taskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  assignedTo: z.string().min(1, "Please assign to someone"),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  project: z.string().min(1, "Project is required"),
  reportType: z.string().min(1, "Report type is required"),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export default function CreateTask() {
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  const onSubmit = async (data: TaskFormValues) => {
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Task created successfully!");
    navigate("/admin/tasks");
  };

  const addChecklistItem = () => {
    if (newItem.trim()) {
      setChecklist([...checklist, newItem.trim()]);
      setNewItem("");
    }
  };

  const employees = users.filter((u) => u.role === "employee");

  return (
    <PageWrapper>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tasks
      </button>

      <div className="page-header">
        <h1 className="page-title">Create New Task</h1>
        <p className="page-subtitle">Assign work to your team members</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass-panel p-6 max-w-2xl space-y-5">
        {/* Title */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Title</label>
          <input {...register("title")} className="w-full px-4 py-2.5 rounded-xl input-field bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50" placeholder="Task title" />
          {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <textarea {...register("description")} rows={3} className="w-full px-4 py-2.5 rounded-xl input-field bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50" placeholder="Describe the task…" />
          {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assigned To</label>
            <select {...register("assignedTo")} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50">
              <option value="">Select employee</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {errors.assignedTo && <p className="text-xs text-destructive mt-1">{errors.assignedTo.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Due Date</label>
            <input {...register("dueDate")} type="date" className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50" />
            {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Priority</label>
            <select {...register("priority")} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Project / Site</label>
            <select {...register("project")} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50">
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.project && <p className="text-xs text-destructive mt-1">{errors.project.message}</p>}
          </div>
        </div>

        {/* Report Type */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Report Type</label>
          <select {...register("reportType")} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50">
            <option value="">Select template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.reportType}>{t.name}</option>
            ))}
          </select>
          {errors.reportType && <p className="text-xs text-destructive mt-1">{errors.reportType.message}</p>}
        </div>

        {/* Checklist */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Checklist (optional)</label>
          <div className="flex gap-2 mb-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
              className="flex-1 px-4 py-2 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none text-sm focus:border-primary/50"
              placeholder="Add checklist item"
            />
            <button type="button" onClick={addChecklistItem} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {/* Attachments dropzone */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Attachments</label>
          <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Drag & drop files or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">UI only — files won't be uploaded</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "Create Task"}
        </button>
      </form>
    </PageWrapper>
  );
}
