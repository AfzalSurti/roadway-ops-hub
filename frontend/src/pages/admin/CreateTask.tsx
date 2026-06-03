import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DPR_TASK_DATA } from "@/lib/dpr-task-catalog";
import { useQuery } from "@tanstack/react-query";

const taskSchema = z
  .object({
    project: z.string().min(1, "Please select project"),
    taskCategory: z.string().min(1, "Please select main task"),
    title: z.string().min(2, "Please select sub task"),
    customSubTask: z.string().optional(),
    assignedToId: z.string().min(1, "Please assign to someone"),
    allocatedAt: z.string().min(1, "Assigned date is required"),
    allottedDays: z.string().optional(),
    ratingEnabled: z.boolean().default(false)
  })
  .superRefine((data, ctx) => {
    if (data.title === "Other" && (!data.customSubTask || data.customSubTask.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customSubTask"],
        message: "Please enter custom sub task"
      });
    }
  });

type TaskFormValues = z.infer<typeof taskSchema>;

const TASK_DRAFT_KEY = "highwayops_create_task_draft";

type TaskDraft = Partial<TaskFormValues> & {
  taskCategory?: string;
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

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: draft.title ?? "",
      project: draft.project ?? "",
      taskCategory: draft.taskCategory ?? "",
      customSubTask: draft.customSubTask ?? "",
      assignedToId: draft.assignedToId ?? "",
      allocatedAt: draft.allocatedAt ?? new Date().toISOString().split("T")[0],
      allottedDays: draft.allottedDays ?? "",
      ratingEnabled: draft.ratingEnabled ?? false
    }
  });

  const values = watch();
  const selectedProject = watch("project");
  const selectedCategory = watch("taskCategory");
  const selectedSubTask = watch("title");
  const subTasks = useMemo(() => DPR_TASK_DATA[selectedCategory] ?? [], [selectedCategory]);
  const { data: projects = [] } = useQuery({ queryKey: ["projects", "create-task"], queryFn: () => api.getProjects() });

  const selectedProjectRecord = useMemo(
    () => projects.find((project) => project.name === selectedProject),
    [projects, selectedProject]
  );

  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setValue("project", projects[0].name, { shouldValidate: true, shouldDirty: true });
      clearErrors("project");
    }
  }, [selectedProject, projects, setValue, clearErrors]);

  useEffect(() => {
    if (!selectedProject) return;
    const stillVisible = projects.some((project) => project.name === selectedProject);
    if (!stillVisible) {
      setValue("project", "", { shouldValidate: true, shouldDirty: true });
    }
  }, [selectedProject, projects, setValue]);

  useEffect(() => {
    const payload: TaskDraft = {
      ...values
    };
    sessionStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(payload));
  }, [values]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      const resolvedSubTask = data.title === "Other" ? data.customSubTask!.trim() : data.title;
      const combinedTitle = `${data.taskCategory} - ${resolvedSubTask}`;
      await api.createTask({
        title: combinedTitle,
        description: "-",
        projectCode: selectedProjectRecord?.projectCodePrefix ?? undefined,
        projectNumber: selectedProjectRecord?.projectNumber ?? undefined,
        allottedDays: data.allottedDays ? Number(data.allottedDays) : undefined,
        ratingEnabled: data.ratingEnabled,
        assignedToId: data.assignedToId,
        allocatedAt: data.allocatedAt,
        project: data.project
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Project</label>
            <select
              {...register("project")}
              aria-label="Project"
              title="Project"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              onChange={(event) => {
                setValue("project", event.target.value, { shouldValidate: true, shouldDirty: true });
                clearErrors("project");
              }}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.name}>
                  {project.name} {project.projectNumber ? `(${project.projectNumber})` : ""}
                </option>
              ))}
            </select>
            {errors.project && <p className="text-xs text-destructive mt-1">{errors.project.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Main Task</label>
            <select
              {...register("taskCategory")}
              aria-label="Main Task"
              title="Main Task"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              onChange={(event) => {
                const nextCategory = event.target.value;
                setValue("taskCategory", nextCategory, { shouldValidate: true, shouldDirty: true });
                setValue("title", "", { shouldValidate: true, shouldDirty: true });
                setValue("customSubTask", "", { shouldValidate: true, shouldDirty: true });
                clearErrors(["taskCategory", "title", "customSubTask"]);
              }}
            >
              <option value="">Select main task</option>
              {Object.keys(DPR_TASK_DATA).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.taskCategory && <p className="text-xs text-destructive mt-1">{errors.taskCategory.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Sub Task</label>
            <select
              {...register("title")}
              aria-label="Sub Task"
              title="Sub Task"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              disabled={!selectedCategory || subTasks.length === 0}
              onChange={(event) => {
                const selected = event.target.value;
                setValue("title", selected, { shouldValidate: true, shouldDirty: true });
                if (selected !== "Other") {
                  setValue("customSubTask", "", { shouldValidate: true, shouldDirty: true });
                  clearErrors("customSubTask");
                }
                clearErrors("title");
              }}
            >
              <option value="">{selectedCategory ? "Select sub task" : "Select main task first"}</option>
              {subTasks.map((subTask) => (
                <option key={subTask} value={subTask}>
                  {subTask}
                </option>
              ))}
            </select>
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>
        </div>

        {selectedSubTask === "Other" && (
          <div>
            <label className="text-sm font-medium mb-1.5 block">Custom Sub Task</label>
            <input
              {...register("customSubTask")}
              type="text"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
              placeholder="Type your custom sub task"
            />
            {errors.customSubTask && <p className="text-xs text-destructive mt-1">{errors.customSubTask.message}</p>}
          </div>
        )}

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
            <label className="text-sm font-medium mb-1.5 block">Assigned Date</label>
            <input
              {...register("allocatedAt")}
              type="date"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            />
            {errors.allocatedAt && <p className="text-xs text-destructive mt-1">{errors.allocatedAt.message}</p>}
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

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register("ratingEnabled")} className="rounded" />
              Rating on above task
            </label>
            <p className="text-xs text-muted-foreground mt-1">Checked: rating applied. Unchecked: rating not applied.</p>
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