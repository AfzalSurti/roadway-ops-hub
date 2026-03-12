import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { Plus, Trash2, X, Search, Hash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { statusConfig } from "@/lib/domain";

type WizardStep = 1 | 2 | 3 | 4 | 5;

type NumberWizardState = {
  projectId: string;
  companyCode: "G" | "S" | "I" | "H" | "";
  technicalUnitCode: "T" | "S" | "D" | "";
  subTechnicalUnitCode: string;
  workCategoryCode: string;
  baseCode: string;
};

const FALLBACK_COMPANIES = [
  { label: "Geo Designs & Research Pvt. Ltd", code: "G" },
  { label: "Sai Geotechnical Lab", code: "S" },
  { label: "Inertia Engineering Solution", code: "I" },
  { label: "Shree Hari Testing Lab", code: "H" }
];

const FALLBACK_TECHNICAL_UNITS = [
  { label: "Testing Consultancy", code: "T" },
  { label: "Supervision Consultancy", code: "S" },
  { label: "Building Designs Consultancy", code: "D" }
];

const FALLBACK_SUB_TECHNICAL_UNITS: Record<string, Array<{ label: string; code: string }>> = {
  T: [
    { label: "Geotechnical Exploration", code: "GE" },
    { label: "Laboratory Testing", code: "MT" },
    { label: "Load Testing Services (Bridge/Pile)", code: "LT" },
    { label: "Chemical Environment Testing", code: "CE" },
    { label: "NDT", code: "ND" }
  ],
  S: [
    { label: "Authority Engineer", code: "AE" },
    { label: "Independent Engineer", code: "IE" },
    { label: "Project Management Consultant", code: "PM" },
    { label: "Third Party Inspection", code: "TP" },
    { label: "Proof Checking", code: "PC" },
    { label: "Field Highway Testing", code: "FH" },
    { label: "Road Safety Audit", code: "RS" },
    { label: "Environment Audit", code: "EA" }
  ],
  D: [
    { label: "Architectural Design", code: "AR" },
    { label: "Structural Design", code: "ST" },
    { label: "BIM Services", code: "BM" },
    { label: "Utilities Design Services", code: "UD" },
    { label: "Quantity Survey & Estimation", code: "QS" },
    { label: "Energy Audit Services", code: "EN" },
    { label: "Green Building Services", code: "GB" },
    { label: "Building Infrastructure Designs", code: "BU" },
    { label: "Road Infrastructure Designs", code: "IR" },
    { label: "Bridge Infrastructure Designs", code: "IB" },
    { label: "Industrial Infrastructure & Park", code: "IS" },
    { label: "Marine Infrastructure", code: "MS" },
    { label: "Detail Design Infrastructure", code: "DD" },
    { label: "Hydro Engineering", code: "HE" },
    { label: "Tunnel Engineering", code: "TE" }
  ]
};

const FALLBACK_FH_WORK_CATEGORIES = [
  { label: "NSV Test", code: "N" },
  { label: "FWD Test", code: "F" },
  { label: "BBD Test", code: "B" },
  { label: "Roughness Index (BI/IRI) Test", code: "I" },
  { label: "Pavement Design", code: "P" },
  { label: "Retro Reflectometer Test", code: "R" },
  { label: "Topography / LiDAR Survey", code: "S" },
  { label: "Traffic Survey (Incl. ATCC / TMC / Videography / Axel load etc.)", code: "T" },
  { label: "Bridge Load Test", code: "L" },
  { label: "Mobile Bridge Inspection Unit", code: "M" }
];

const FALLBACK_DEFAULT_WORK_CATEGORIES = [
  { label: "Road", code: "R" },
  { label: "Building", code: "B" },
  { label: "Canal", code: "C" },
  { label: "Irrigation", code: "I" },
  { label: "Bridge", code: "G" },
  { label: "Pre Bid", code: "P" },
  { label: "Drainage", code: "D" }
];

const DEFAULT_WIZARD: NumberWizardState = {
  projectId: "",
  companyCode: "",
  technicalUnitCode: "",
  subTechnicalUnitCode: "",
  workCategoryCode: "",
  baseCode: ""
};

function getFinancialYearShort(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 3 ? year % 100 : (year - 1) % 100;
}

export default function AdminProjects() {
  const [showCreate, setShowCreate] = useState(false);
  const [showNumberWizard, setShowNumberWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizard, setWizard] = useState<NumberWizardState>(DEFAULT_WIZARD);
  const [assigningNumber, setAssigningNumber] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", "projects-summary"],
    queryFn: () => api.getTasks({ limit: 500 })
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const { data: numberingOptions } = useQuery({
    queryKey: ["project-numbering-options"],
    queryFn: () => api.getProjectNumberingOptions()
  });

  const resolvedCompanies = numberingOptions?.companies ?? FALLBACK_COMPANIES;
  const resolvedTechnicalUnits = numberingOptions?.technicalUnits ?? FALLBACK_TECHNICAL_UNITS;

  const tasks = tasksData?.items ?? [];

  const projectRows = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project === project.name);
      const totalTasks = projectTasks.length;
      const pendingTasks = projectTasks.filter((task) => task.status !== "DONE").length;
      const overdueTasks = projectTasks.filter((task) => task.status !== "DONE" && new Date(task.dueDate) < new Date()).length;

      return {
        id: project.id,
        projectName: project.name,
        description: project.description ?? "",
        projectNumber: project.projectNumber ?? "-",
        projectCodePrefix: project.projectCodePrefix ?? "",
        totalTasks,
        pendingTasks,
        overdueTasks,
        tasks: projectTasks
      };
    });
  }, [projects, tasks]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projectRows;
    return projectRows.filter((row) => {
      return row.projectName.toLowerCase().includes(query) || row.projectNumber.toLowerCase().includes(query);
    });
  }, [projectRows, search]);

  const selectedProject = useMemo(
    () => projectRows.find((row) => row.id === selectedProjectId) ?? null,
    [projectRows, selectedProjectId]
  );

  const projectsWithoutNumber = useMemo(
    () => projects.filter((project) => !project.projectNumber),
    [projects]
  );

  const wizardProject = useMemo(
    () => projects.find((project) => project.id === wizard.projectId) ?? null,
    [projects, wizard.projectId]
  );

  const subTechnicalOptions = useMemo(() => {
    if (!wizard.technicalUnitCode) return [];
    return (
      numberingOptions?.subTechnicalUnits[wizard.technicalUnitCode] ??
      FALLBACK_SUB_TECHNICAL_UNITS[wizard.technicalUnitCode] ??
      []
    );
  }, [wizard.technicalUnitCode, numberingOptions]);

  const workCategoryOptions = useMemo(() => {
    return wizard.subTechnicalUnitCode === "FH"
      ? numberingOptions?.workCategories.fieldHighwayTesting ?? FALLBACK_FH_WORK_CATEGORIES
      : numberingOptions?.workCategories.default ?? FALLBACK_DEFAULT_WORK_CATEGORIES;
  }, [wizard.subTechnicalUnitCode, numberingOptions]);

  const currentCodePreview = useMemo(() => {
    if (wizard.baseCode) {
      return `${wizard.baseCode}${wizard.workCategoryCode}`;
    }
    const prefixOnly = `${wizard.companyCode}${wizard.technicalUnitCode}${wizard.subTechnicalUnitCode}`;
    return prefixOnly || "-";
  }, [wizard]);

  const resetWizard = () => {
    setWizard(DEFAULT_WIZARD);
    setWizardStep(1);
    setShowNumberWizard(false);
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      await api.createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined
      });
      await Promise.all([refetchProjects(), refetchTasks()]);
      setForm({ name: "", description: "" });
      setShowCreate(false);
      toast.success("Project added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add project";
      toast.error(message);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    const shouldDelete = window.confirm(`Delete project \"${name}\"?`);
    if (!shouldDelete) return;

    try {
      setDeletingId(id);
      await api.deleteProject(id);
      await Promise.all([refetchProjects(), refetchTasks()]);
      toast.success("Project deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const goNextWizard = async () => {
    if (wizardStep === 1 && !wizard.projectId) {
      toast.error("Please select a project");
      return;
    }
    if (wizardStep === 2 && !wizard.companyCode) {
      toast.error("Please select company");
      return;
    }
    if (wizardStep === 3 && !wizard.technicalUnitCode) {
      toast.error("Please select technical unit");
      return;
    }
    if (wizardStep === 4) {
      if (!wizard.technicalUnitCode) {
        toast.error("Please select technical unit");
        return;
      }
      if (!wizard.subTechnicalUnitCode) {
        toast.error("Please select sub technical unit");
        return;
      }

      const projectCodePrefix = `${wizard.companyCode}${wizard.technicalUnitCode}${wizard.subTechnicalUnitCode}`;

      try {
        const preview = await api.previewProjectNumber({
          companyCode: wizard.companyCode,
          technicalUnitCode: wizard.technicalUnitCode,
          subTechnicalUnitCode: wizard.subTechnicalUnitCode
        });
        setWizard((prev) => ({ ...prev, baseCode: preview.baseCode }));
      } catch (error) {
        // Fallback: derive FY+serial locally if preview endpoint is unavailable in current deployment.
        const fy = getFinancialYearShort();
        const fyText = String(fy).padStart(2, "0");
        const maxSerial = projects
          .filter((project) => project.projectCodePrefix === projectCodePrefix && project.financialYearShort === fy)
          .reduce((max, project) => Math.max(max, project.serialNumber ?? 0), 0);
        const nextSerial = String(maxSerial + 1).padStart(2, "0");
        const baseCode = `${projectCodePrefix}${fyText}${nextSerial}`;
        setWizard((prev) => ({ ...prev, baseCode }));

        const message = error instanceof Error ? error.message : "Preview route unavailable";
        toast.warning(`${message}. Generated preview locally for now.`);
      }
    }

    setWizardStep((prev) => {
      if (prev >= 5) return 5;
      return (prev + 1) as WizardStep;
    });
  };

  const goBackWizard = () => {
    setWizardStep((prev) => {
      if (prev <= 1) return 1;
      return (prev - 1) as WizardStep;
    });
  };

  const handleAssignProjectNumber = async () => {
    if (!wizard.projectId || !wizard.companyCode || !wizard.technicalUnitCode || !wizard.subTechnicalUnitCode || !wizard.workCategoryCode) {
      toast.error("Please complete all required selections");
      return;
    }

    try {
      setAssigningNumber(true);
      await api.assignProjectNumber(wizard.projectId, {
        companyCode: wizard.companyCode,
        technicalUnitCode: wizard.technicalUnitCode,
        subTechnicalUnitCode: wizard.subTechnicalUnitCode,
        workCategoryCode: wizard.workCategoryCode
      });
      await refetchProjects();
      toast.success("Project number assigned");
      resetWizard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign project number";
      toast.error(message);
    } finally {
      setAssigningNumber(false);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Project-wise task status summary</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowNumberWizard(true);
              setWizardStep(1);
              setWizard(DEFAULT_WIZARD);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary font-medium text-sm hover:bg-primary/10 transition-colors"
          >
            <Hash className="h-4 w-4" />
            Add Project Number
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Project
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects or number..."
          className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Project Name</th>
                <th className="text-left p-4 font-medium">Project Number</th>
                <th className="text-left p-4 font-medium">Total Tasks</th>
                <th className="text-left p-4 font-medium">Pending</th>
                <th className="text-left p-4 font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setSelectedProjectId(row.id)}
                  className="border-b border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{row.projectName}</span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteProject(row.id, row.projectName);
                        }}
                        disabled={deletingId === row.id}
                        className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        title="Delete project"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-medium">{row.projectNumber}</td>
                  <td className="p-4 font-medium">{row.totalTasks}</td>
                  <td className="p-4 font-medium">{row.pendingTasks}</td>
                  <td className="p-4 font-medium">{row.overdueTasks}</td>
                </motion.tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-muted-foreground">No projects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setSelectedProjectId(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
            className="glass-panel-strong p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Project Details</h3>
              <button onClick={() => setSelectedProjectId(null)} className="p-1 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Project Name</p>
                <p className="font-medium mt-1">{selectedProject.projectName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Number</p>
                <p className="font-medium mt-1">{selectedProject.projectNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Code Prefix</p>
                <p className="font-medium mt-1">{selectedProject.projectCodePrefix || "-"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 text-sm">{selectedProject.description.trim() || "No description added."}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
                <p className="font-medium mt-1">{selectedProject.totalTasks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="font-medium mt-1">{selectedProject.pendingTasks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="font-medium mt-1">{selectedProject.overdueTasks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="font-medium mt-1">{selectedProject.tasks.filter((task) => task.status === "DONE").length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Tasks In This Project</p>
              {selectedProject.tasks.length ? (
                <div className="space-y-2">
                  {[...selectedProject.tasks]
                    .sort((a, b) => {
                      const aDone = a.status === "DONE" ? 1 : 0;
                      const bDone = b.status === "DONE" ? 1 : 0;
                      if (aDone !== bDone) return aDone - bDone;
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((task) => (
                      <div key={task.id} className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Assigned to: {task.assignedTo?.name ?? "-"} | Due: {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`status-badge text-[10px] ${statusConfig[task.status].color}`}>{statusConfig[task.status].label}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks in this project yet.</p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Project</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Project name"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                placeholder="Project description (optional)"
              />
              <button
                onClick={() => void handleCreateProject()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Create Project
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showNumberWizard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel-strong p-6 w-full max-w-2xl mx-4"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Add Project Number</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Step {wizardStep} of 5 | Project: {wizardProject?.name ?? "Not selected"} | Current Code: {currentCodePreview}
                </p>
              </div>
              <button
                onClick={resetWizard}
                className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
              >
                Discard
              </button>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Select Project (only projects without number)</p>
                <select
                  value={wizard.projectId}
                  onChange={(event) => setWizard((prev) => ({ ...prev, projectId: event.target.value }))}
                  title="Select project"
                  aria-label="Select project"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50"
                >
                  <option value="">Select project</option>
                  {projectsWithoutNumber.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {projectsWithoutNumber.length === 0 && <p className="text-xs text-muted-foreground">All projects already have numbers.</p>}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">a) Initial of Company Name (select one)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resolvedCompanies.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setWizard((prev) => ({ ...prev, companyCode: item.code as NumberWizardState["companyCode"] }))}
                      className={`text-left px-3 py-2 rounded-xl border ${wizard.companyCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Code: {item.code}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">b) Initial of Technical Unit (select one)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {resolvedTechnicalUnits.map((item) => (
                    <button
                      key={item.code}
                      onClick={() =>
                        setWizard((prev) => ({
                          ...prev,
                          technicalUnitCode: item.code as NumberWizardState["technicalUnitCode"],
                          subTechnicalUnitCode: "",
                          workCategoryCode: "",
                          baseCode: ""
                        }))
                      }
                      className={`text-left px-3 py-2 rounded-xl border ${wizard.technicalUnitCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Code: {item.code}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">c) Initial of Sub Technical Unit ({wizard.technicalUnitCode})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {subTechnicalOptions.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setWizard((prev) => ({ ...prev, subTechnicalUnitCode: item.code, workCategoryCode: "", baseCode: "" }))}
                      className={`text-left px-3 py-2 rounded-xl border ${wizard.subTechnicalUnitCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Code: {item.code}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">f) Prefix Initial of Work Category</p>
                <p className="text-xs text-muted-foreground">
                  {wizard.subTechnicalUnitCode === "FH"
                    ? "Field Highway Testing selected, choose one service code"
                    : "Choose one work category code"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {workCategoryOptions.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => setWizard((prev) => ({ ...prev, workCategoryCode: item.code }))}
                      className={`text-left px-3 py-2 rounded-xl border ${wizard.workCategoryCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Code: {item.code}</p>
                    </button>
                  ))}
                </div>
                {wizard.baseCode && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">Generated Base Code</p>
                    <p className="text-base font-semibold mt-1">{wizard.baseCode}</p>
                    <p className="text-xs text-muted-foreground mt-1">Final Project Number: {wizard.baseCode}{wizard.workCategoryCode || ""}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-5">
              <button
                onClick={goBackWizard}
                disabled={wizardStep === 1}
                className="px-4 py-2 rounded-lg border border-border/50 text-sm disabled:opacity-40"
              >
                Back
              </button>

              {wizardStep < 5 ? (
                <button
                  onClick={() => void goNextWizard()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => void handleAssignProjectNumber()}
                  disabled={assigningNumber || !wizard.workCategoryCode}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium disabled:opacity-60"
                >
                  {assigningNumber ? "Assigning..." : "Finish"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
