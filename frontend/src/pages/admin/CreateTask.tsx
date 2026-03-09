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
  title: z.string().min(2, "Please select DPR activity"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  assignedToId: z.string().min(1, "Please assign to someone"),
  allocatedAt: z.string().min(1, "Assigned date is required"),
  allottedDays: z.string().optional(),
  ratingEnabled: z.boolean().default(true),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
});

type TaskFormValues = z.infer<typeof taskSchema>;

const TASK_DRAFT_KEY = "highwayops_create_task_draft";

type TaskDraft = Partial<TaskFormValues> & {
  taskQuery?: string;
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

  const [taskQuery, setTaskQuery] = useState(draft.taskQuery ?? "");

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const {
    data: dprActivities = [],
    isLoading: isDprActivitiesLoading,
    isError: isDprActivitiesError
  } = useQuery({ queryKey: ["dpr-activities"], queryFn: () => api.getDprActivities() });
  const filteredActivities = useMemo(() => {
    const query = taskQuery.trim().toLowerCase();
    if (!query) {
      return dprActivities;
    }

    return dprActivities.filter((activity) => activity.label.toLowerCase().includes(query));
  }, [dprActivities, taskQuery]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: draft.title ?? "",
      description: draft.description ?? "",
      assignedToId: draft.assignedToId ?? "",
      allocatedAt: draft.allocatedAt ?? new Date().toISOString().split("T")[0],
      allottedDays: draft.allottedDays ?? "",
      ratingEnabled: draft.ratingEnabled ?? true,
      priority: draft.priority ?? "MEDIUM"
    }
  });

  const values = watch();

  useEffect(() => {
    const payload: TaskDraft = {
      ...values,
      taskQuery
    };
    sessionStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(payload));
  }, [values, taskQuery]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      await api.createTask({
        ...data,
        allottedDays: data.allottedDays ? Number(data.allottedDays) : undefined,
        ratingEnabled: data.ratingEnabled,
        reportTemplateId: undefined,
        allocatedAt: data.allocatedAt,
        project: "DPR Activity"
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
          <label className="text-sm font-medium mb-1.5 block">DPR Activity</label>
          <input
            value={taskQuery}
            onChange={(event) => {
              const value = event.target.value;
              setTaskQuery(value);
              setValue("title", value, { shouldValidate: true, shouldDirty: true });
              const selected = dprActivities.find((activity) => activity.label === value);
              if (selected && !getValues("description")?.trim()) {
                setValue("description", selected.description, { shouldValidate: true, shouldDirty: true });
              }
            }}
            list="dpr-activity-options"
            title="DPR Activity"
            placeholder={isDprActivitiesLoading ? "Loading tasks..." : "Type to search and select task"}
            className="w-full mb-2 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
            disabled={isDprActivitiesLoading || isDprActivitiesError || dprActivities.length === 0}
          />
          <datalist id="dpr-activity-options">
            {filteredActivities.map((activity) => (
              <option key={activity.id} value={activity.label} />
            ))}
          </datalist>
          <input type="hidden" {...register("title")} />
          {!isDprActivitiesLoading && !isDprActivitiesError && dprActivities.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Task section is empty</p>
          )}
          {!isDprActivitiesLoading && !isDprActivitiesError && dprActivities.length > 0 && filteredActivities.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No matching tasks</p>
          )}
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

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...register("ratingEnabled")} className="rounded" />
              Apply rating formula on this task
            </label>
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