import { useMemo, useState } from "react";
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
  assignedToId: z.string().min(1, "Please assign to someone"),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  reportTemplateId: z.string().min(1, "Template is required")
});

type TaskFormValues = z.infer<typeof taskSchema>;

export default function CreateTask() {
  const navigate = useNavigate();
  const [projectMode, setProjectMode] = useState<"existing" | "other">("existing");
  const [selectedProject, setSelectedProject] = useState("");
  const [otherProject, setOtherProject] = useState("");

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => api.getTemplates() });
  const { data: projectsResult = [] } = useQuery({ queryKey: ["projects"], queryFn: () => api.getProjects() });

  const projects = useMemo(() => projectsResult.map((project) => project.name), [projectsResult]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "MEDIUM" }
  });

  const onSubmit = async (data: TaskFormValues) => {
    const project = projectMode === "existing" ? selectedProject : otherProject.trim();
    if (!project) {
      toast.error("Project is required");
      return;
    }

    try {
      await api.createTask({
        ...data,
        project
      });
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
            <label className="text-sm font-medium mb-1.5 block">Priority</label>
            <select
              {...register("priority")}
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
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Template</label>
          <select
            {...register("reportTemplateId")}
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