import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SubStaffAssignment, SubStaffClientCategory } from "@/lib/domain";
import {
  SubStaffFormFields,
  emptySubStaffForm,
  subStaffFormFromEntry,
  subStaffFormToPayload,
  applySubStaffDefaults,
  type SubStaffFormState
} from "@/components/substaff/SubStaffFormFields";
import { SubStaffImportDialog } from "@/components/substaff/SubStaffImportDialog";
import { SubStaffPlanTable } from "@/components/substaff/SubStaffPlanTable";
import { StaffProfileDialog } from "@/components/substaff/StaffProfileDialog";
import { ProjectProfileDialog } from "@/components/substaff/ProjectProfileDialog";
import { ClashSolutionDialog } from "@/components/substaff/ClashSolutionDialog";
import { ReassignmentSuggestionsDialog } from "@/components/substaff/ReassignmentSuggestionsDialog";
import { DataCleanupDialog } from "@/components/substaff/DataCleanupDialog";
import { downloadSubStaffImportTemplate } from "@/lib/sub-staff-import";
import { AlertTriangle, Download, FileUp, Loader2, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CLIENT_CATEGORY_OPTIONS: Array<{ value: SubStaffClientCategory | "ALL"; label: string }> = [
  { value: "ALL", label: "All Clients" },
  { value: "MORTH", label: "MORTH" },
  { value: "NHAI", label: "NHAI" },
  { value: "NH_DIVISION", label: "NH Division" },
  { value: "OTHER", label: "Other" }
];

export default function StaffPlanning() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "LEFT">("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState<SubStaffClientCategory | "ALL">("ALL");
  const [searchName, setSearchName] = useState("");
  const [searchDesignation, setSearchDesignation] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [addForm, setAddForm] = useState<SubStaffFormState>(emptySubStaffForm);
  const [editingEntry, setEditingEntry] = useState<SubStaffAssignment | null>(null);
  const [editForm, setEditForm] = useState<SubStaffFormState>(emptySubStaffForm);
  const [profileStaffName, setProfileStaffName] = useState<string | null>(null);
  const [profileProjectName, setProfileProjectName] = useState<string | null>(null);
  const [solutionStaffName, setSolutionStaffName] = useState<string | null>(null);
  const [reassignmentAssignmentId, setReassignmentAssignmentId] = useState<string | null>(null);
  const [showDataCleanup, setShowDataCleanup] = useState(false);

  const now = new Date();
  const [planYear, setPlanYear] = useState(now.getFullYear());
  const [planMonth, setPlanMonth] = useState(now.getMonth() + 1);
  const [planSearchName, setPlanSearchName] = useState("");
  const [planSearchDesignation, setPlanSearchDesignation] = useState("");
  const [planSearchProject, setPlanSearchProject] = useState("");
  const [planCategoryFilter, setPlanCategoryFilter] = useState<SubStaffClientCategory | "ALL">("ALL");

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["sub-staff-assignments", statusFilter, categoryFilter, searchName, searchDesignation, searchProject],
    queryFn: () =>
      api.getSubStaffAssignments({
        status: statusFilter,
        clientCategory: categoryFilter === "ALL" ? undefined : categoryFilter,
        staffName: searchName || undefined,
        designation: searchDesignation || undefined,
        siteName: searchProject || undefined
      })
  });

  const { data: options } = useQuery({
    queryKey: ["sub-staff-options"],
    queryFn: () => api.getSubStaffOptions()
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects(),
    staleTime: 60_000
  });
  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name, projectNumber: p.projectNumber ?? null })),
    [projects]
  );
  const projectNameOptions = useMemo(
    () => projectOptions.map((p) => p.name).filter(Boolean),
    [projectOptions]
  );

  const { data: clashReport } = useQuery({
    queryKey: ["sub-staff-clashes"],
    queryFn: () => api.getSubStaffClashes()
  });

  const { data: planRows = [], isLoading: loadingPlan } = useQuery({
    queryKey: ["sub-staff-plan", planYear, planMonth],
    queryFn: () => api.getSubStaffPlan(planYear, planMonth)
  });

  const refreshAssignments = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sub-staff-assignments"] }),
      queryClient.invalidateQueries({ queryKey: ["sub-staff-clashes"] })
    ]);

  const addMutation = useMutation({
    mutationFn: () => api.createSubStaffAssignment(subStaffFormToPayload(addForm)),
    onSuccess: async () => {
      toast.success("Staff record added");
      setShowAdd(false);
      setAddForm(emptySubStaffForm);
      await refreshAssignments();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add record")
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingEntry) throw new Error("No record selected");
      return api.updateSubStaffAssignment(editingEntry.id, subStaffFormToPayload(editForm));
    },
    onSuccess: async () => {
      toast.success("Staff record saved");
      setEditingEntry(null);
      await refreshAssignments();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save record")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSubStaffAssignment(id),
    onSuccess: async () => {
      toast.success("Staff record deleted");
      setEditingEntry(null);
      await refreshAssignments();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete")
  });

  const generatePlanMutation = useMutation({
    mutationFn: () => api.generateSubStaffPlan(planYear, planMonth),
    onSuccess: async () => {
      toast.success("Plan generated");
      await queryClient.invalidateQueries({ queryKey: ["sub-staff-plan", planYear, planMonth] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to generate plan")
  });

  const setPlanDayMutation = useMutation({
    mutationFn: ({
      assignmentId,
      field,
      value
    }: {
      assignmentId: string;
      field: "construction" | "dlp";
      value: number;
    }) => api.setSubStaffPlanDay(assignmentId, planYear, planMonth, field, value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sub-staff-plan", planYear, planMonth] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update day")
  });

  const confirmPlanDayMutation = useMutation({
    mutationFn: ({ assignmentId, confirmed }: { assignmentId: string; confirmed: boolean }) =>
      api.confirmSubStaffPlanDay(assignmentId, planYear, planMonth, confirmed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sub-staff-plan", planYear, planMonth] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update")
  });

  function openEdit(entry: SubStaffAssignment) {
    setEditingEntry(entry);
    setEditForm(subStaffFormFromEntry(entry));
  }

  const planByPerson = useMemo(() => {
    const nameQ = planSearchName.trim().toLowerCase();
    const designationQ = planSearchDesignation.trim().toLowerCase();
    const projectQ = planSearchProject.trim().toLowerCase();

    const groups = new Map<string, typeof planRows>();
    for (const row of planRows) {
      if (nameQ && !row.assignment.staffName.toLowerCase().includes(nameQ)) continue;
      if (designationQ && !row.assignment.designation.toLowerCase().includes(designationQ)) continue;
      if (projectQ && !row.assignment.siteName.toLowerCase().includes(projectQ)) continue;
      if (planCategoryFilter !== "ALL" && row.assignment.clientCategory !== planCategoryFilter) continue;
      const key = row.assignment.staffName.trim().toLowerCase() || row.assignment.id;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    return [...groups.values()].sort((a, b) => a[0].assignment.staffName.localeCompare(b[0].assignment.staffName));
  }, [planRows, planSearchName, planSearchDesignation, planSearchProject, planCategoryFilter]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title inline-flex items-center gap-2">
          <Users className="h-6 w-6" /> Sub-Professional Staff Planning
        </h1>
        <p className="page-subtitle">
          Intermediate staff deployment across sites — data entry, duplicate/clash detection, and monthly
          attendance planning.
        </p>
      </div>

      {clashReport && clashReport.clashCount > 0 ? (
        <div className="glass-panel p-4 mb-4 border border-amber-500/40 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {clashReport.clashCount} staff member(s) on multiple designations/sites
          </p>
          <div className="mt-2 space-y-1.5 max-h-40 overflow-auto">
            {clashReport.clashes.map((clash) => (
              <p key={clash.staffName} className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5">
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  onClick={() => setProfileStaffName(clash.staffName)}
                >
                  {clash.staffName}
                </button>
                — {clash.assignments.map((a) => `${a.designation} @ ${a.siteName}`).join(" · ")}
                <button
                  type="button"
                  className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setSolutionStaffName(clash.staffName)}
                >
                  <Sparkles className="h-3 w-3" />
                  Solution
                </button>
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="data-entry">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="data-entry">Data Entry</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="data-entry" className="space-y-4 pt-4">
          <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as SubStaffClientCategory | "ALL")}>
            <TabsList className="flex w-full flex-wrap h-auto">
              {CLIENT_CATEGORY_OPTIONS.map((opt) => (
                <TabsTrigger key={opt.value} value={opt.value} className="flex-1">
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ACTIVE" | "LEFT")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LEFT">Left</SelectItem>
              </SelectContent>
            </Select>
            <SearchableSelect
              className="w-[200px]"
              value={searchName}
              onChange={setSearchName}
              options={options?.staffNames ?? []}
              placeholder="Staff name"
              searchPlaceholder="Search staff name..."
              allLabel="All staff"
            />
            <SearchableSelect
              className="w-[180px]"
              value={searchDesignation}
              onChange={setSearchDesignation}
              options={options?.designations ?? []}
              placeholder="Designation"
              searchPlaceholder="Search designation..."
              allLabel="All designations"
            />
            <SearchableSelect
              className="w-[200px]"
              value={searchProject}
              onChange={setSearchProject}
              options={projectNameOptions}
              placeholder="Project"
              searchPlaceholder="Search project..."
              allLabel="All projects"
            />
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadSubStaffImportTemplate()}>
                <Download className="h-4 w-4" />
                Sample Excel
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setShowImport(true)}>
                <FileUp className="h-4 w-4" />
                Import Excel
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDataCleanup(true)}>
                Fix Duplicates
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setAddForm(emptySubStaffForm);
                  setShowAdd(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Staff
              </Button>
            </div>
          </div>

          <div className="glass-panel p-5">
            {loadingAssignments ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading records...
              </p>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No records yet. Click "Add Staff" or "Import Excel" to begin.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="bg-secondary/30 text-muted-foreground">
                      <th className="p-2.5 text-left font-medium">Staff Name</th>
                      <th className="p-2.5 text-left font-medium">Designation</th>
                      <th className="p-2.5 text-left font-medium">Project Name</th>
                      <th className="p-2.5 text-left font-medium">Project No.</th>
                      <th className="p-2.5 text-left font-medium">Co-Ordinator</th>
                      <th className="p-2.5 text-right font-medium">Rate</th>
                      <th className="p-2.5 text-right font-medium">Total MM</th>
                      <th className="p-2.5 text-right font-medium">Used MM</th>
                      <th className="p-2.5 text-right font-medium">Staff Balance MM</th>
                      <th className="p-2.5 text-left font-medium">Start Date</th>
                      <th className="p-2.5 text-left font-medium">End Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-border/20 hover:bg-secondary/20 cursor-pointer"
                        onClick={() => openEdit(entry)}
                      >
                        <td className="p-2.5 font-medium">
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProfileStaffName(entry.staffName);
                            }}
                          >
                            {entry.staffName}
                          </button>
                        </td>
                        <td className="p-2.5">{entry.designation || "—"}</td>
                        <td className="p-2.5">
                          {entry.siteName ? (
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProfileProjectName(entry.siteName);
                              }}
                            >
                              {entry.siteName}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2.5">{entry.projectNumber || "—"}</td>
                        <td className="p-2.5">{entry.coOrdinator || "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{money(entry.rate)}</td>
                        <td className="p-2.5 text-right tabular-nums">{entry.totalMm.toFixed(2)}</td>
                        <td className="p-2.5 text-right tabular-nums">{entry.usedMm.toFixed(2)}</td>
                        <td className="p-2.5 text-right tabular-nums font-medium">
                          {(entry.totalMm - entry.usedMm).toFixed(2)}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">{formatDate(entry.startDate)}</td>
                        <td className="p-2.5 whitespace-nowrap">{formatDate(entry.endDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4 pt-4">
          <Tabs
            value={planCategoryFilter}
            onValueChange={(v) => setPlanCategoryFilter(v as SubStaffClientCategory | "ALL")}
          >
            <TabsList className="flex w-full flex-wrap h-auto">
              {CLIENT_CATEGORY_OPTIONS.map((opt) => (
                <TabsTrigger key={opt.value} value={opt.value} className="flex-1">
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
            <Select value={String(planMonth)} onValueChange={(v) => setPlanMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(planYear)} onValueChange={(v) => setPlanYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={generatePlanMutation.isPending}
              onClick={() => generatePlanMutation.mutate()}
            >
              <RefreshCw className="h-4 w-4" />
              {generatePlanMutation.isPending ? "Generating..." : "Generate / Refresh Plan"}
            </Button>
          </div>
          <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
            <SearchableSelect
              className="w-[200px]"
              value={planSearchName}
              onChange={setPlanSearchName}
              options={options?.staffNames ?? []}
              placeholder="Staff name"
              searchPlaceholder="Search staff name..."
              allLabel="All staff"
            />
            <SearchableSelect
              className="w-[180px]"
              value={planSearchDesignation}
              onChange={setPlanSearchDesignation}
              options={options?.designations ?? []}
              placeholder="Designation"
              searchPlaceholder="Search designation..."
              allLabel="All designations"
            />
            <SearchableSelect
              className="w-[200px]"
              value={planSearchProject}
              onChange={setPlanSearchProject}
              options={projectNameOptions}
              placeholder="Project"
              searchPlaceholder="Search project..."
              allLabel="All projects"
            />
            <p className="text-xs text-muted-foreground">
              Auto-fills each person's days per site from balance MM, remaining time and rate — edits you
              make stick and won't be overwritten by a refresh.
            </p>
          </div>

          <div className="glass-panel p-5">
            {loadingPlan ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading plan...
              </p>
            ) : planByPerson.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No active staff records yet, or no plan generated for this month.
              </p>
            ) : (
              <div className="space-y-4">
                {planByPerson.map((rows) => {
                  const staffName = rows[0].assignment.staffName;
                  const totalDays = rows.reduce((s, r) => s + r.plannedDaysConstruction + r.plannedDaysDlp, 0);
                  return (
                    <div key={staffName} className="rounded-xl border border-border/40 overflow-hidden">
                      <div className="px-4 py-2.5 bg-secondary/20 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          className="font-medium text-sm underline underline-offset-2 hover:text-primary"
                          onClick={() => setProfileStaffName(staffName)}
                        >
                          {staffName}
                        </button>
                        <Badge variant={totalDays > 30 ? "destructive" : "secondary"}>
                          {totalDays.toFixed(1)} / 30 days this month
                        </Badge>
                      </div>
                      <SubStaffPlanTable
                        rows={rows}
                        firstColumnLabel="Site"
                        renderFirstColumn={(row) =>
                          row.assignment.siteName ? (
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-primary"
                              onClick={() => setProfileProjectName(row.assignment.siteName)}
                            >
                              {row.assignment.siteName}
                            </button>
                          ) : (
                            "—"
                          )
                        }
                        onEditPlanDay={(assignmentId, field, value) =>
                          setPlanDayMutation.mutate({ assignmentId, field, value })
                        }
                        onConfirmPlanDay={(assignmentId, confirmed) =>
                          confirmPlanDayMutation.mutate({ assignmentId, confirmed })
                        }
                        onFindOpenPositions={(assignmentId) => setReassignmentAssignmentId(assignmentId)}
                        budgetScope="person"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Staff Record</DialogTitle>
            <DialogDescription>One row per staff member per designation per site.</DialogDescription>
          </DialogHeader>
          <SubStaffFormFields
            value={addForm}
            onChange={(patch) => {
              const changedKey = Object.keys(patch)[0] as keyof SubStaffFormState;
              setAddForm((prev) => applySubStaffDefaults({ ...prev, ...patch }, changedKey));
            }}
            designationOptions={options?.designations ?? []}
            staffNameOptions={options?.staffNames ?? []}
            projectOptions={projectOptions}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button disabled={!addForm.staffName.trim() || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingEntry)} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff Record</DialogTitle>
            <DialogDescription>
              {editingEntry ? `${editingEntry.staffName} — ${editingEntry.designation || "no designation"}` : ""}
            </DialogDescription>
          </DialogHeader>
          <SubStaffFormFields
            value={editForm}
            onChange={(patch) => {
              const changedKey = Object.keys(patch)[0] as keyof SubStaffFormState;
              setEditForm((prev) => applySubStaffDefaults({ ...prev, ...patch }, changedKey));
            }}
            designationOptions={options?.designations ?? []}
            staffNameOptions={options?.staffNames ?? []}
            projectOptions={projectOptions}
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (editingEntry && window.confirm("Delete this staff record?")) deleteMutation.mutate(editingEntry.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubStaffImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        designationOptions={options?.designations ?? []}
        staffNameOptions={options?.staffNames ?? []}
        projectOptions={projectOptions}
      />
      <StaffProfileDialog
        staffName={profileStaffName}
        onClose={() => setProfileStaffName(null)}
        designationFilter={searchDesignation}
        projectFilter={searchProject}
      />
      <ProjectProfileDialog
        projectName={profileProjectName}
        onClose={() => setProfileProjectName(null)}
        designationFilter={searchDesignation}
        staffNameFilter={searchName}
        designationOptions={options?.designations ?? []}
        staffNameOptions={options?.staffNames ?? []}
        projectOptions={projectOptions}
      />
      <ClashSolutionDialog staffName={solutionStaffName} onClose={() => setSolutionStaffName(null)} />
      <ReassignmentSuggestionsDialog
        assignmentId={reassignmentAssignmentId}
        onClose={() => setReassignmentAssignmentId(null)}
      />
      <DataCleanupDialog
        open={showDataCleanup}
        onClose={() => setShowDataCleanup(false)}
        projectOptions={projectOptions}
        designationOptions={options?.designations ?? []}
      />
    </PageWrapper>
  );
}
