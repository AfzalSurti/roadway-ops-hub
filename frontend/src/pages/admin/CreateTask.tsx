import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const taskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  projectCode: z.string().optional(),
  projectNumber: z.string().optional(),
  assignedToId: z.string().min(1, "Please assign to someone"),
  dueDate: z.string().min(1, "Due date is required"),
  allottedDays: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  reportTemplateId: z.string().min(1, "Template is required")
});

type TaskFormValues = z.infer<typeof taskSchema>;

const TASK_DRAFT_KEY = "highwayops_create_task_draft";

type TaskDraft = Partial<TaskFormValues> & {
  projectMode?: "existing" | "other";
  selectedProject?: string;
  otherProject?: string;
};

export default function CreateTask() {
  const navigate = useNavigate();
  const draft: TaskDraft = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(TASK_DRAFT_KEY);
      return raw ? (JSON.parse(raw) as TaskDraft) : {};
    } catch {
      return {};
    }
  }, []);

  const [projectMode, setProjectMode] = useState<"existing" | "other">(draft.projectMode ?? "existing");
  const [selectedProject, setSelectedProject] = useState(draft.selectedProject ?? "");
  const [otherProject, setOtherProject] = useState(draft.otherProject ?? "");

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => api.getTemplates() });
  const { data: projectsResult = [] } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });

  const projects = useMemo(() => projectsResult.map((project) => project.name), [projectsResult]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: draft.title ?? "",
      description: draft.description ?? "",
      assignedToId: draft.assignedToId ?? "",
      dueDate: draft.dueDate ?? "",
      projectCode: draft.projectCode ?? "",
      projectNumber: draft.projectNumber ?? "",
      allottedDays: draft.allottedDays ?? "",
      priority: draft.priority ?? "MEDIUM",
      reportTemplateId: draft.reportTemplateId ?? ""
    }
  });

  const values = watch();

  useEffect(() => {
    const payload: TaskDraft = {
      ...values,
      projectMode,
      selectedProject,
      otherProject
    };
    sessionStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(payload));
  }, [values, projectMode, selectedProject, otherProject]);

  const onSubmit = async (data: TaskFormValues) => {
    const project = projectMode === "existing" ? selectedProject : otherProject.trim();
    if (!project) {
      toast.error("Project is required");
      return;
    }

    try {
      await api.createTask({
        ...data,
        projectCode: data.projectCode?.trim() || undefined,
        projectNumber: data.projectNumber?.trim() || undefined,
        allottedDays: data.allottedDays ? Number(data.allottedDays) : undefined,
        project
      });
      sessionStorage.removeItem(TASK_DRAFT_KEY);
      toast.success("Task created successfully!");
      navigate("/admin/tasks");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create task";
      toast.error(message);
    }
  };

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
        <div>
          <label className="text-sm font-medium mb-1.5 block">Title</label>
          <input
            {...register("title")}
            className="w-full px-4 py-2.5 rounded-xl input-field bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            placeholder="Task title"
          />
          {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl input-field bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
            placeholder="Describe the task…"
          />
          {errors.description && <p className="text-xs text-destructive mt-1">{errors.description.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assigned To</label>
            <select
              {...register("assignedToId")}
              aria-label="Assigned To"
              title="Assigned To"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Select employee</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            {errors.assignedToId && <p className="text-xs text-destructive mt-1">{errors.assignedToId.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Due Date</label>
            <input
              {...register("dueDate")}
              type="date"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            />
            {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Submission Period (Days)</label>
            <input
              {...register("allottedDays")}
              type="number"
              min={1}
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              placeholder="e.g. 7"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Priority</label>
            <select
              {...register("priority")}
              aria-label="Priority"
              title="Priority"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Project / Site</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setProjectMode("existing")}
                className={`px-3 py-2 rounded-lg text-xs border ${
                  projectMode === "existing"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-secondary/50 text-muted-foreground border-border/50"
                }`}
              >
                Existing Project
              </button>
              <button
                type="button"
                onClick={() => setProjectMode("other")}
                className={`px-3 py-2 rounded-lg text-xs border ${
                  projectMode === "other"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-secondary/50 text-muted-foreground border-border/50"
                }`}
              >
                Other Project
              </button>
            </div>

            {projectMode === "existing" ? (
              <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
                aria-label="Existing Project"
                title="Existing Project"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              >
                <option value="">Select existing project</option>
                {projects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={otherProject}
                onChange={(event) => setOtherProject(event.target.value)}
                placeholder="Enter new project name"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <input
                {...register("projectCode")}
                placeholder="Project code (optional)"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              />
              <input
                {...register("projectNumber")}
                placeholder="Project number (optional)"
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Template</label>
          <select
            {...register("reportTemplateId")}
            aria-label="Template"
            title="Template"
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          {errors.reportTemplateId && <p className="text-xs text-destructive mt-1">{errors.reportTemplateId.message}</p>}
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