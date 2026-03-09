import { useEffect, useMemo } from "react";
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
  taskCategory: z.string().min(1, "Please select main task"),
  title: z.string().min(2, "Please select sub task"),
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
  taskCategory?: string;
};

const TASK_DATA: Record<string, string[]> = {
  "Project Management": [
    "Submission of Monthly Progress Report",
    "Submission of Quaterly Progress Report",
    "Submission of Extension of Time Limit Proposal",
    "Submission of Excess / Extra Proposal",
    "Other"
  ],
  "Inception Report & QAP": [
    "Kick-off Meeting with client & preliminary Project site visit",
    "Geometric Design of Existing Alignment",
    "Existing Road Inventory",
    "Existing Bridges, Culverts & Structures Inventory",
    "Submission of Draft Inception Report & QAP",
    "Comments from Concern approval authority & Its Compliance",
    "Submission of Final Inception Report & QAP",
    "Approval of Final Inception Report & QAP",
    "Other"
  ],
  "Feasibility Report": [
    "Geometric Design for various Alignment options",
    "Detailed Topographic Survey",
    "Submission of Traffic surveys Report (incl. Volume count, Axel load, TMC, O-D survey etc..)",
    "Submission of Black Spots audit report",
    "Submission of Draft Alignment Option Report & Presentation",
    "Submission of Final Alignment Report",
    "Approval of Final Alignment Report",
    "Collect & Testing of Various materials (Cement, Steel, Aggregates, Bitumen etc.) and Submission of Material Report",
    "Submission of NSV Report",
    "Condition survey for Existing CD works, Bridges & Structures",
    "Submission of Inventory & Condition Survey Report",
    "Subgrade Characteristics and Strength survey (soil sample testing)",
    "Submission of Pavement Structural Strength Survey (BBD / FWD) Report",
    "Submission of Geo Technical Investigation and sub soil Exploration Report",
    "Submission of Hydraulic and Hydrological Survey report",
    "Submission of Environment and Social Impact Assessment report",
    "Submission of Draft Pavement Design report (With Alternative Design Options)",
    "Submission of Rate Analysis",
    "Submission of Cost / Block Estimate",
    "Submission of Economic and financial analysis report",
    "Submission of Preliminary land acquisition Report",
    "Submission of Alignment/Strip plan and Alignment Drawing (TCS)",
    "Submission of Draft Feasibility Report",
    "Comments from Concern approval authority & Its Compliance",
    "Submission of Final Feasibility Report",
    "Other"
  ],
  "LA-I Report": [
    "Collection of Village Maps & Land revenue records",
    "Liasion for appointment of CALA & Publication of 3A Gazette Notification",
    "Preparation of Draft 3A Notifications",
    "Submission of Estimated Cost of Land Acquisition",
    "Submission of LA-I Report incl. Strip / LA Plan",
    "Comments from Concern approval authority & Its Compliance",
    "Submission of Final LA-I Report incl. Strip/LA Plan",
    "Other"
  ],
  "Utility-I Report": [
    "Identification of surface utilities",
    "Ground Penetrating Radar (GPR) Survey for sub-surface utilities",
    "Submission of identification letter to Utility owner",
    "Consultation with Utility agency & discussion on relocation cost",
    "Submission of Utility Shifting proposals to user agency",
    "Submission of Utility-I Report & Utility relocation plan",
    "Other"
  ],
  "Clearance-I Report": [
    "Initial consultation with Environment/Forest/Wildlife/CRZ authorities",
    "Collection of Reserved Forest survey numbers",
    "Details/cost of trees being felled from Forest Office",
    "Preparation of EIA Report",
    "Mapping of CRZ Boundary by authorised agency",
    "Submission of Clearance proposals",
    "Submission of Clearance-I Report",
    "Other"
  ],
  "Detailed Project Report (DPR)": [
    "Detailed Topography Survey on Approved Alignment",
    "Submission of DPR Main Report & Draft DPR",
    "Submission of Design Based Report (Road Design)",
    "Submission of Traffic Report",
    "Submission of NSV Report",
    "Submission of FWD Report",
    "Submission of Final Pavement Design report",
    "Submission of Economic and financial analysis report",
    "Submission of Black Spot Audit report",
    "Submission of Design Based Report (Structure Design)",
    "Submission of Inventory & Condition survey report",
    "Submission of Geo-technical and sub-soil explorations report",
    "Submission of Hydraulic & Hydrological Investigation report",
    "Submission of Material Report",
    "Submission of Environmental and Social Impact Assessment report",
    "Submission of Technical Specifications",
    "Submission of Rate Analysis",
    "Submission of Detailed Estimates",
    "Submission of Drawings (Road/Highway, Structure & Facilities)",
    "Submission of Drainage Design Report",
    "Submission of Drainage Plan",
    "Comments from approval authority on Draft DPR",
    "Submission of Final DPR",
    "Approval of Final DPR",
    "Other"
  ],
  "Bid documents and civil works contract agreement": [
    "Submission of Draft Civil work contract Agreement with technical schedule",
    "Submission of Draft Bid Documents (RFP / NIT)",
    "Approval of Civil work contract Agreement & Bid Documents",
    "Other"
  ],
  "LA-II Report": [
    "Liasion for Publication of 3A Gazette Notification",
    "Fixing of Boundary pillar for PROW marking",
    "Joint measurement survey with authority",
    "Valuation of existing properties",
    "Liasion for Publication of 3D Gazette Notification",
    "Submission of LA-II Report incl. Final Strip/LA Plan",
    "Other"
  ],
  "Utility-II Report": [
    "Joint site inspection with competent authority",
    "Submission of Utility Shifting Estimates",
    "Collection of NO upgradation certificate",
    "Approval of Utility Shifting Estimates",
    "Submission of Utility-II Report & Final Utility relocation plan",
    "Other"
  ],
  "Clearance-II Report": [
    "Liasion for Public Hearing (EC)",
    "Final environment clearance by authority",
    "Joint site inspection with DFO (Forest Clearance)",
    "Liasion for FRA certificate",
    "Stage I forest clearance approval",
    "Stage II forest clearance approval",
    "Joint site inspection for Wildlife clearance",
    "Stage I Wild clearance approval",
    "Stage II Wild clearance approval",
    "Site Visit by GCZMA/State Govt (CRZ)",
    "Presentation before committee (CRZ)",
    "Final CRZ clearance",
    "Final GAD Approval (Railway/Irrigation etc.)",
    "Submission of Final Clearance-II Report",
    "Other"
  ],
  "Land Award Report (LA-III Report)": [
    "Liasion for Award Declaration (3G)",
    "Submission of Land Award Report",
    "Other"
  ],
  "Land possession Report (LA-IV Report)": [
    "Liasion for Deposition of compensation amount by Govt to CALA",
    "Liasion for Amount Disbursement to Land owners",
    "Receipt of Land Possession Certificate 3(E)",
    "Submission of Land possession Report",
    "Other"
  ]
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
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: draft.title ?? "",
      taskCategory: draft.taskCategory ?? "",
      description: draft.description ?? "",
      assignedToId: draft.assignedToId ?? "",
      allocatedAt: draft.allocatedAt ?? new Date().toISOString().split("T")[0],
      allottedDays: draft.allottedDays ?? "",
      ratingEnabled: draft.ratingEnabled ?? true,
      priority: draft.priority ?? "MEDIUM"
    }
  });

  const values = watch();
  const selectedCategory = watch("taskCategory");
  const subTasks = useMemo(() => TASK_DATA[selectedCategory] ?? [], [selectedCategory]);

  useEffect(() => {
    const payload: TaskDraft = {
      ...values
    };
    sessionStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(payload));
  }, [values]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      const combinedTitle = `${data.taskCategory} - ${data.title}`;
      await api.createTask({
        ...data,
        title: combinedTitle,
        allottedDays: data.allottedDays ? Number(data.allottedDays) : undefined,
        ratingEnabled: data.ratingEnabled,
        reportTemplateId: undefined,
        allocatedAt: data.allocatedAt,
        project: data.taskCategory
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
              }}
            >
              <option value="">Select main task</option>
              {Object.keys(TASK_DATA).map((category) => (
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