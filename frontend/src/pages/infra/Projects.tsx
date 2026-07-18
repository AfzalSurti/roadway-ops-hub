import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { ProjectFinancialDetailsFields } from "@/components/admin/ProjectFinancialDetailsFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { InfraTeamMemberItem } from "@/lib/domain";
import { projectToFinancialDetailsForm } from "@/lib/project-financial-details";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Loader2, Plus, Search, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const INFRA_CODES = ["IE", "AE", "PM", "TP"] as const;

type PanelMode = "assign" | "mobilize" | null;

function assignmentStatus(assignment: { mobilizedAt?: string | null; demobilizedAt?: string | null }) {
  if (assignment.demobilizedAt) return "Demobilized" as const;
  if (assignment.mobilizedAt) return "Mobilized" as const;
  return "Assigned" as const;
}

function statusBadgeVariant(status: ReturnType<typeof assignmentStatus>) {
  if (status === "Mobilized") return "default" as const;
  if (status === "Assigned") return "secondary" as const;
  return "outline" as const;
}

function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
  emptyText
}: {
  members: InfraTeamMemberItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((item) => item !== id));
  };

  return (
    <div className="max-h-56 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
      {members.map((member) => {
        const checked = selectedIds.includes(member.id);
        return (
          <label
            key={member.id}
            className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/30 transition-colors"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => toggle(member.id, value === true)}
              className="mt-0.5"
              aria-label={`Select ${member.name}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{member.name}</span>
              <span className="block text-xs text-muted-foreground">
                {member.manpowerRole}
                {member.email ? ` · ${member.email}` : ""}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function InfraProjects() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>(searchParams.get("unit") ?? "ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>(searchParams.get("lifecycle") ?? "ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(searchParams.get("open"));
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [mobilizedAt, setMobilizedAt] = useState(new Date().toISOString().slice(0, 10));
  const [demobilizedAt, setDemobilizedAt] = useState(new Date().toISOString().slice(0, 10));
  const [otherDraft, setOtherDraft] = useState({ description: "", actualAmount: "", drawnAmount: "" });

  const { data: projects = [], isLoading } = useQuery({ queryKey: ["infra-projects"], queryFn: () => api.getInfraProjects() });
  const { data: team = [] } = useQuery({ queryKey: ["infra-team"], queryFn: () => api.getInfraTeamMembers() });
  const { data: selectedProject, isLoading: loadingSelected } = useQuery({
    queryKey: ["infra-project", selectedProjectId],
    queryFn: () => (selectedProjectId ? api.getInfraProject(selectedProjectId) : Promise.resolve(null)),
    enabled: Boolean(selectedProjectId)
  });

  useEffect(() => {
    const unit = searchParams.get("unit");
    const lifecycle = searchParams.get("lifecycle");
    const open = searchParams.get("open");
    if (unit) setUnitFilter(unit);
    if (lifecycle) setLifecycleFilter(lifecycle);
    if (open) setSelectedProjectId(open);
  }, [searchParams]);

  useEffect(() => {
    setPanelMode(null);
    setSelectedMemberIds([]);
  }, [selectedProjectId]);

  const refreshProjectQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["infra-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["infra-project", selectedProjectId] }),
      queryClient.invalidateQueries({ queryKey: ["infra-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["infra-team"] })
    ]);
  };

  const assignMutation = useMutation({
    mutationFn: () => {
      if (selectedMemberIds.length === 0) throw new Error("Select at least one employee");
      return api.assignInfraProject(selectedProjectId!, {
        teamMemberIds: selectedMemberIds,
        mode: "assign"
      });
    },
    onSuccess: async () => {
      toast.success(
        selectedMemberIds.length === 1
          ? "Employee assigned to project"
          : `${selectedMemberIds.length} employees assigned to project`
      );
      setSelectedMemberIds([]);
      setPanelMode(null);
      await refreshProjectQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to assign")
  });

  const mobilizeMutation = useMutation({
    mutationFn: () => {
      if (selectedMemberIds.length === 0) throw new Error("Select at least one employee");
      if (!mobilizedAt) throw new Error("Please select mobilization date");
      return api.assignInfraProject(selectedProjectId!, {
        teamMemberIds: selectedMemberIds,
        mode: "mobilize",
        mobilizedAt: new Date(`${mobilizedAt}T00:00:00`).toISOString()
      });
    },
    onSuccess: async () => {
      toast.success(
        selectedMemberIds.length === 1
          ? "Employee mobilized to project"
          : `${selectedMemberIds.length} employees mobilized to project`
      );
      setSelectedMemberIds([]);
      setPanelMode(null);
      await refreshProjectQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to mobilize")
  });

  const demobilizeMutation = useMutation({
    mutationFn: (assignmentId: string) => {
      if (!demobilizedAt) throw new Error("Please select demobilization date");
      return api.updateInfraProjectAssignment(selectedProjectId!, assignmentId, {
        demobilizedAt: new Date(`${demobilizedAt}T00:00:00`).toISOString()
      });
    },
    onSuccess: async () => {
      toast.success("Employee demobilized");
      await refreshProjectQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to demobilize")
  });

  const addOtherCostMutation = useMutation({
    mutationFn: () => {
      if (!selectedProjectId) throw new Error("No project selected");
      if (!otherDraft.description.trim()) throw new Error("Description is required");
      const actual = otherDraft.actualAmount.trim() === "" ? null : Number(otherDraft.actualAmount);
      const drawn = otherDraft.drawnAmount.trim() === "" ? null : Number(otherDraft.drawnAmount);
      if (actual !== null && (!Number.isFinite(actual) || actual < 0)) throw new Error("Invalid actual amount");
      if (drawn !== null && (!Number.isFinite(drawn) || drawn < 0)) throw new Error("Invalid drawn amount");
      return api.createInfraOtherCost(selectedProjectId, {
        description: otherDraft.description.trim(),
        actualAmount: actual === null ? null : Number(actual.toFixed(2)),
        drawnAmount: drawn === null ? null : Number(drawn.toFixed(2))
      });
    },
    onSuccess: async () => {
      toast.success("Other cost added");
      setOtherDraft({ description: "", actualAmount: "", drawnAmount: "" });
      await refreshProjectQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add other cost")
  });

  const deleteOtherCostMutation = useMutation({
    mutationFn: (costId: string) => {
      if (!selectedProjectId) throw new Error("No project selected");
      return api.deleteInfraOtherCost(selectedProjectId, costId);
    },
    onSuccess: async () => {
      toast.success("Other cost removed");
      await refreshProjectQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to remove cost")
  });

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const code = project.subTechnicalUnitCode ?? project.projectNumber?.slice(2, 4) ?? "";
      if (!INFRA_CODES.includes(code as (typeof INFRA_CODES)[number])) return false;
      if (unitFilter !== "ALL" && code !== unitFilter) return false;
      if (lifecycleFilter !== "ALL" && project.lifecycle !== lifecycleFilter) return false;
      if (!query) return true;
      return [project.name, project.projectNumber, code].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [projects, search, unitFilter, lifecycleFilter]);

  const activeAssignments = useMemo(
    () => (selectedProject?.assignments ?? []).filter((assignment) => !assignment.demobilizedAt),
    [selectedProject]
  );

  const activeMemberIds = useMemo(
    () => new Set(activeAssignments.map((assignment) => assignment.teamMemberId)),
    [activeAssignments]
  );

  const assignableMembers = useMemo(
    () => team.filter((member) => !activeMemberIds.has(member.id)),
    [team, activeMemberIds]
  );

  const mobilizableMembers = useMemo(() => {
    const assignedNotMobilized = activeAssignments
      .filter((assignment) => !assignment.mobilizedAt)
      .map((assignment) => assignment.teamMember);
    const notOnProject = team.filter((member) => !activeMemberIds.has(member.id));
    const byId = new Map<string, InfraTeamMemberItem>();
    [...assignedNotMobilized, ...notOnProject].forEach((member) => byId.set(member.id, member));
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeAssignments, team, activeMemberIds]);

  const financialForm = useMemo(
    () => (selectedProject ? projectToFinancialDetailsForm(selectedProject) : null),
    [selectedProject]
  );

  const closeDetails = () => {
    setSelectedProjectId(null);
    setPanelMode(null);
    setSelectedMemberIds([]);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next);
  };

  const openPanel = (mode: PanelMode) => {
    setPanelMode(mode);
    setSelectedMemberIds([]);
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Infra Projects</h1>
          <p className="page-subtitle">Projects with IE, AE, PM, and TP sub-technical units from Admin.</p>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search project name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Units</SelectItem>
              {INFRA_CODES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Lifecycle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="rounded-full self-center">
            {filteredProjects.length} project(s)
          </Badge>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-3 pr-4 text-left font-medium">Project Number</th>
                <th className="py-3 px-4 text-left font-medium">Project Name</th>
                <th className="py-3 px-4 text-left font-medium">Sub Unit</th>
                <th className="py-3 px-4 text-left font-medium">Lifecycle</th>
                <th className="py-3 px-4 text-right font-medium">Active Assignments</th>
                <th className="py-3 pl-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading projects...</span></td></tr>
              ) : null}
              {!isLoading && filteredProjects.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No infra projects found.</td></tr>
              ) : null}
              {!isLoading && filteredProjects.map((project) => (
                <tr key={project.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="py-3 pr-4 font-medium">{project.projectNumber || "-"}</td>
                  <td className="py-3 px-4">{project.name}</td>
                  <td className="py-3 px-4"><Badge variant="outline">{project.subTechnicalUnitCode || "-"}</Badge></td>
                  <td className="py-3 px-4"><Badge>{project.lifecycle}</Badge></td>
                  <td className="py-3 px-4 text-right tabular-nums">{project.activeAssignments}</td>
                  <td className="py-3 pl-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        const next = new URLSearchParams(searchParams);
                        next.set("open", project.id);
                        setSearchParams(next);
                      }}
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProjectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={closeDetails}>
          <div
            className="glass-panel-strong w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {loadingSelected || !selectedProject || !financialForm ? (
              <div className="py-16 flex justify-center text-muted-foreground">
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading project...</span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-lg font-semibold">Project Details</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedProject.projectNumber || "No project number"} · {selectedProject.lifecycle}
                    </p>
                  </div>
                  <button aria-label="Close" onClick={closeDetails} className="p-1.5 rounded-lg hover:bg-secondary/50">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Project Name</p>
                    <p className="font-medium mt-1">{selectedProject.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Project Number</p>
                    <p className="font-medium mt-1">{selectedProject.projectNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sub Technical Unit</p>
                    <p className="font-medium mt-1">{selectedProject.subTechnicalUnitCode || "-"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="mt-1 text-sm">{selectedProject.description?.trim() || "No description added."}</p>
                  </div>

                  <ProjectFinancialDetailsFields form={financialForm} isEditing={false} onChange={() => undefined} />
                </div>

                <div className="border-t border-border/30 pt-5 mt-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">Other Project Costs</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vehicle, equipment, misc. Optional actual (paid) and drawn (govt.) amounts. Included in Financial monitoring totals.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <Input
                      className="sm:col-span-2"
                      placeholder="Description (e.g. Vehicle amount)"
                      value={otherDraft.description}
                      onChange={(e) => setOtherDraft((prev) => ({ ...prev, description: e.target.value }))}
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Actual (optional)"
                      value={otherDraft.actualAmount}
                      onChange={(e) => setOtherDraft((prev) => ({ ...prev, actualAmount: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Drawn (optional)"
                        value={otherDraft.drawnAmount}
                        onChange={(e) => setOtherDraft((prev) => ({ ...prev, drawnAmount: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="gap-1 shrink-0"
                        disabled={addOtherCostMutation.isPending || !otherDraft.description.trim()}
                        onClick={() => addOtherCostMutation.mutate()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                  </div>
                  {(selectedProject.infraOtherCosts ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No other costs added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedProject.infraOtherCosts ?? []).map((cost) => {
                        const pl = Number(((Number(cost.drawnAmount) || 0) - (Number(cost.actualAmount) || 0)).toFixed(2));
                        return (
                          <div
                            key={cost.id}
                            className="rounded-xl border border-border/40 bg-secondary/20 p-3 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{cost.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Actual: {cost.actualAmount != null ? formatInr(cost.actualAmount) : "-"}
                                {" · "}
                                Drawn: {cost.drawnAmount != null ? formatInr(cost.drawnAmount) : "-"}
                                {" · "}
                                P/L:{" "}
                                <span className={pl > 0 ? "text-emerald-600" : pl < 0 ? "text-red-500" : ""}>
                                  {formatInr(pl)}
                                </span>
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={deleteOtherCostMutation.isPending}
                              onClick={() => {
                                if (window.confirm("Remove this other cost?")) {
                                  deleteOtherCostMutation.mutate(cost.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs sm:text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <span>Actual total: <strong className="tabular-nums">{formatInr(selectedProject.totalActualAmount ?? 0)}</strong></span>
                    <span>Drawn total: <strong className="tabular-nums">{formatInr(selectedProject.totalDrawnAmount ?? 0)}</strong></span>
                    <span>
                      P/L:{" "}
                      <strong
                        className={`tabular-nums ${
                          (selectedProject.totalProfitLoss ?? 0) > 0
                            ? "text-emerald-600"
                            : (selectedProject.totalProfitLoss ?? 0) < 0
                              ? "text-red-500"
                              : ""
                        }`}
                      >
                        {formatInr(selectedProject.totalProfitLoss ?? 0)}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-5 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                      <p className="text-sm font-semibold text-primary">Team Deployment</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assign links employees to the project. Mobilize sets the field start date.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={panelMode === "assign" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openPanel(panelMode === "assign" ? null : "assign")}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign
                      </Button>
                      <Button
                        variant={panelMode === "mobilize" ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openPanel(panelMode === "mobilize" ? null : "mobilize")}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Mobilize
                      </Button>
                    </div>
                  </div>

                  {panelMode === "assign" ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5 space-y-3">
                      <p className="text-sm font-medium">Assign employees (one or multiple)</p>
                      <MemberMultiSelect
                        members={assignableMembers}
                        selectedIds={selectedMemberIds}
                        onChange={setSelectedMemberIds}
                        emptyText="All team members are already on this project."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => assignMutation.mutate()}
                          disabled={selectedMemberIds.length === 0 || assignMutation.isPending}
                          className="gap-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          {assignMutation.isPending
                            ? "Assigning..."
                            : `Assign${selectedMemberIds.length ? ` (${selectedMemberIds.length})` : ""}`}
                        </Button>
                        <Button variant="ghost" onClick={() => openPanel(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}

                  {panelMode === "mobilize" ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5 space-y-3">
                      <p className="text-sm font-medium">Mobilize employees (one or multiple) + date</p>
                      <MemberMultiSelect
                        members={mobilizableMembers}
                        selectedIds={selectedMemberIds}
                        onChange={setSelectedMemberIds}
                        emptyText="No employees available to mobilize."
                      />
                      <div>
                        <label htmlFor="mobilize-date" className="text-xs text-muted-foreground mb-1.5 block">
                          Mobilized Date *
                        </label>
                        <Input
                          id="mobilize-date"
                          type="date"
                          value={mobilizedAt}
                          onChange={(e) => setMobilizedAt(e.target.value)}
                          className="max-w-[220px]"
                          required
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => mobilizeMutation.mutate()}
                          disabled={selectedMemberIds.length === 0 || !mobilizedAt || mobilizeMutation.isPending}
                          className="gap-2"
                        >
                          <Users className="h-4 w-4" />
                          {mobilizeMutation.isPending
                            ? "Mobilizing..."
                            : `Mobilize${selectedMemberIds.length ? ` (${selectedMemberIds.length})` : ""}`}
                        </Button>
                        <Button variant="ghost" onClick={() => openPanel(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-medium">Assigned / Mobilized Team</p>
                    <div>
                      <label htmlFor="demobilize-date" className="sr-only">Demobilize date</label>
                      <Input
                        id="demobilize-date"
                        type="date"
                        value={demobilizedAt}
                        onChange={(e) => setDemobilizedAt(e.target.value)}
                        className="w-[160px]"
                      />
                    </div>
                  </div>

                  {selectedProject.assignments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assignments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProject.assignments.map((assignment) => {
                        const status = assignmentStatus(assignment);
                        return (
                          <div
                            key={assignment.id}
                            className="rounded-xl border border-border/40 bg-secondary/20 p-3 flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{assignment.teamMember.name}</p>
                                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {assignment.teamMember.manpowerGroup} · {assignment.teamMember.manpowerRole}
                                {assignment.teamMember.email ? ` · ${assignment.teamMember.email}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Assigned: {new Date(assignment.createdAt).toLocaleDateString("en-IN")}
                                {" · "}
                                Mobilized:{" "}
                                {assignment.mobilizedAt
                                  ? new Date(assignment.mobilizedAt).toLocaleDateString("en-IN")
                                  : "-"}
                                {" · "}
                                Demobilized:{" "}
                                {assignment.demobilizedAt
                                  ? new Date(assignment.demobilizedAt).toLocaleDateString("en-IN")
                                  : "-"}
                              </p>
                            </div>
                            {!assignment.demobilizedAt ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1 shrink-0"
                                disabled={demobilizeMutation.isPending || !demobilizedAt}
                                onClick={() => demobilizeMutation.mutate(assignment.id)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                Demobilize
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </PageWrapper>
  );
}
