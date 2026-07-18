import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HodActivityChartDialog } from "@/components/hod/HodActivityChartDialog";
import { HodDprOverviewSection } from "@/components/hod/HodDprOverviewSection";
import { HodInfraProjectDetailDialog } from "@/components/hod/HodInfraProjectDetailDialog";
import { HodProjectDetailDialog } from "@/components/hod/HodProjectDetailDialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinancialProjectBillStatusRow, InfraProjectItem, ProjectItem } from "@/lib/domain";
import {
  collectHodFinancialYearOptions,
  compareHodProjectsByNumber,
  formatHodCurrency,
  formatHodFinancialYearLabel,
  formatHodPercent,
  getCompanyLabel,
  getProjectCompanyCode,
  getProjectFinancialYearShort,
  getProjectLifecycle,
  getAllHodWorkCategoryOptions,
  getHodWorkCategoryOptions,
  getProjectSubTechnicalUnitCode,
  getProjectTechnicalUnitCode,
  getProjectWorkCategoryCode,
  getTasksForProject,
  HOD_COMPANY_OPTIONS,
  HOD_SUB_TECHNICAL_UNIT_OPTIONS,
  HOD_TECHNICAL_UNIT_OPTIONS,
  summarizeProjectTasks
} from "@/lib/hod-dashboard";
import { BarChart3, CheckCircle2, ClipboardList, Eye, FileSpreadsheet, FileText, FolderKanban, Loader2, RefreshCcw, Search, Timer } from "lucide-react";
import {
  downloadInfraProjectBillPdf,
  downloadInfraProjectsSummaryExcel,
  downloadInfraProjectsSummaryPdf
} from "@/lib/infra-financial-export";
import { toast } from "sonner";

/** Infra Admin sub-units from project number chars 3–4 (Supervision Consultancy). */
const INFRA_SUB_UNITS = new Set(["IE", "AE", "PM", "TP"]);

/** Same rule as Infra Admin API: chars 3–4 of project number. */
function getInfraUnitFromProjectNumber(projectNumber?: string | null): string | null {
  const number = projectNumber?.trim().toUpperCase();
  if (!number || number.length < 4) return null;
  const candidate = number.slice(2, 4);
  return INFRA_SUB_UNITS.has(candidate) ? candidate : null;
}

export default function HodDashboard() {
  const [search, setSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("ALL");
  const [technicalUnitFilter, setTechnicalUnitFilter] = useState("ALL");
  const [subTechnicalUnitFilter, setSubTechnicalUnitFilter] = useState("ALL");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [financialYearFilter, setFinancialYearFilter] = useState("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [chartProjectId, setChartProjectId] = useState<string | null>(null);
  const [infraLifecycleFilter, setInfraLifecycleFilter] = useState<string>("ALL");
  const [selectedInfraProjectId, setSelectedInfraProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading: loadingProjects, refetch: refetchProjects } = useQuery({
    queryKey: ["hod-projects"],
    queryFn: () => api.getProjects(),
    staleTime: 5 * 60 * 1000
  });

  const { data: tasksResponse, isLoading: loadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ["hod-tasks"],
    queryFn: () => api.getTasks({ limit: 1000 }),
    staleTime: 2 * 60 * 1000
  });

  const { data: financialBillStatus, isLoading: loadingFinancial, refetch: refetchFinancial } = useQuery({
    queryKey: ["hod-financial-bill-status"],
    queryFn: () => api.getAllProjectsBillStatus(),
    staleTime: 5 * 60 * 1000
  });

  const { data: infraOverview } = useQuery({
    queryKey: ["infra-overview"],
    queryFn: () => api.getInfraOverview(),
    staleTime: 5 * 60 * 1000
  });

  const { data: infraProjects = [], isLoading: loadingInfraProjects, refetch: refetchInfraProjects } = useQuery({
    queryKey: ["infra-projects", "hod"],
    queryFn: () => api.getInfraProjects(),
    staleTime: 5 * 60 * 1000
  });

  const { data: infraTeam = [] } = useQuery({
    queryKey: ["infra-team", "hod"],
    queryFn: () => api.getInfraTeamMembers(),
    staleTime: 5 * 60 * 1000
  });

  const tasks = tasksResponse?.items ?? [];

  const financialByProjectId = useMemo(() => {
    const map = new Map<string, FinancialProjectBillStatusRow>();
    for (const row of financialBillStatus?.rows ?? []) {
      map.set(row.projectId, row);
    }
    return map;
  }, [financialBillStatus]);

  const financialByProjectNumber = useMemo(() => {
    const map = new Map<string, FinancialProjectBillStatusRow>();
    for (const row of financialBillStatus?.rows ?? []) {
      const key = row.projectNo?.trim();
      if (key) map.set(key, row);
    }
    return map;
  }, [financialBillStatus]);

  const subTechnicalOptions = useMemo(() => {
    if (technicalUnitFilter === "ALL") {
      return [];
    }
    return HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitFilter] ?? [];
  }, [technicalUnitFilter]);

  const workCategoryOptions = useMemo(() => {
    if (subTechnicalUnitFilter !== "ALL") {
      return getHodWorkCategoryOptions(subTechnicalUnitFilter);
    }
    return getAllHodWorkCategoryOptions();
  }, [subTechnicalUnitFilter]);

  const financialYearOptions = useMemo(() => collectHodFinancialYearOptions(projects), [projects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const companyCode = getProjectCompanyCode(project);
      const technicalUnitCode = getProjectTechnicalUnitCode(project);
      const subTechnicalUnitCode = getProjectSubTechnicalUnitCode(project);
      const workCategoryCode = getProjectWorkCategoryCode(project);
      const financialYearShort = getProjectFinancialYearShort(project);
      const orgOk = organizationFilter === "ALL" || companyCode === organizationFilter;
      const unitOk = technicalUnitFilter === "ALL" || technicalUnitCode === technicalUnitFilter;
      const subOk = subTechnicalUnitFilter === "ALL" || subTechnicalUnitCode === subTechnicalUnitFilter;
      const workOk = workCategoryFilter === "ALL" || workCategoryCode === workCategoryFilter;
      const fyOk =
        financialYearFilter === "ALL" ||
        (financialYearShort != null && String(financialYearShort) === financialYearFilter);

      if (!orgOk || !unitOk || !subOk || !workOk || !fyOk) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [project.name, project.projectNumber, project.description, getCompanyLabel(getProjectCompanyCode(project))]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [financialYearFilter, organizationFilter, projects, search, subTechnicalUnitFilter, technicalUnitFilter, workCategoryFilter]);

  const projectRows = useMemo(() => {
    return filteredProjects
      .map((project) => {
        const projectTasks = getTasksForProject(project, tasks);
        const summary = summarizeProjectTasks(projectTasks);
        const lifecycle = getProjectLifecycle(projectTasks);
        const financial =
          financialByProjectId.get(project.id) ??
          (project.projectNumber ? financialByProjectNumber.get(project.projectNumber.trim()) : undefined);

        return {
          project,
          projectTasks,
          summary,
          lifecycle,
          woAmountExclGst: financial?.workOrderAmountExclGst ?? null,
          receivedAmountExclGst: financial?.receivedAmountExclGst ?? null,
          financialProgressPct: financial?.financialProgressPct ?? null,
          billingAmount: financial?.raBillRaisedClaim ?? null
        };
      })
      .sort((a, b) => compareHodProjectsByNumber(a.project, b.project));
  }, [filteredProjects, financialByProjectId, financialByProjectNumber, tasks]);

  const totals = useMemo(() => {
    let completed = 0;
    let ongoing = 0;

    for (const row of projectRows) {
      if (row.lifecycle === "COMPLETED") {
        completed += 1;
      } else {
        ongoing += 1;
      }
    }

    return {
      total: projectRows.length,
      completed,
      ongoing
    };
  }, [projectRows]);

  const selectedRow = selectedProjectId ? projectRows.find((row) => row.project.id === selectedProjectId) ?? null : null;
  const chartRow = chartProjectId ? projectRows.find((row) => row.project.id === chartProjectId) ?? null : null;

  /** Section view follows project-number filters: IE/AE/PM/TP → Infra; everything else → DPR. */
  const isInfraSection = INFRA_SUB_UNITS.has(subTechnicalUnitFilter);
  const activeInfraUnit = isInfraSection ? subTechnicalUnitFilter : null;

  const filteredInfraProjects = useMemo(() => {
    // Only when a specific infra sub-unit is selected — never show mixed IE+AE+PM+TP.
    if (!activeInfraUnit) return [];

    const query = search.trim().toLowerCase();
    return infraProjects.filter((project) => {
      const unitFromNumber = getInfraUnitFromProjectNumber(project.projectNumber);
      // Strict: IE filter → only IE projects (from project number), not all infra
      if (unitFromNumber !== activeInfraUnit) return false;

      const companyCode = getProjectCompanyCode(project);
      const technicalUnitCode = getProjectTechnicalUnitCode(project);
      const workCategoryCode = getProjectWorkCategoryCode(project);
      const financialYearShort = getProjectFinancialYearShort(project);

      if (organizationFilter !== "ALL" && companyCode !== organizationFilter) return false;
      if (technicalUnitFilter !== "ALL" && technicalUnitCode !== technicalUnitFilter) return false;
      if (workCategoryFilter !== "ALL" && workCategoryCode !== workCategoryFilter) return false;
      if (
        financialYearFilter !== "ALL" &&
        (financialYearShort == null || String(financialYearShort) !== financialYearFilter)
      ) {
        return false;
      }
      if (infraLifecycleFilter !== "ALL" && project.lifecycle !== infraLifecycleFilter) return false;

      if (!query) return true;
      const haystack = [project.name, project.projectNumber, unitFromNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    activeInfraUnit,
    financialYearFilter,
    infraLifecycleFilter,
    infraProjects,
    organizationFilter,
    search,
    technicalUnitFilter,
    workCategoryFilter
  ]);

  const infraTotals = useMemo(() => {
    const ongoing = filteredInfraProjects.filter((project) => project.lifecycle === "ONGOING").length;
    const completed = filteredInfraProjects.filter((project) => project.lifecycle === "COMPLETED").length;
    const totalActual = Number(
      filteredInfraProjects.reduce((sum, project) => sum + (project.totalActualAmount ?? 0), 0).toFixed(2)
    );
    const totalDrawn = Number(
      filteredInfraProjects.reduce((sum, project) => sum + (project.totalDrawnAmount ?? 0), 0).toFixed(2)
    );
    const totalProfitLoss = Number((totalDrawn - totalActual).toFixed(2));
    return {
      total: filteredInfraProjects.length,
      ongoing,
      completed,
      totalActual,
      totalDrawn,
      totalProfitLoss
    };
  }, [filteredInfraProjects]);

  const selectedInfraProject =
    selectedInfraProjectId
      ? filteredInfraProjects.find((project) => project.id === selectedInfraProjectId) ??
        infraProjects.find((project) => project.id === selectedInfraProjectId) ??
        null
      : null;

  const resetFilters = () => {
    setSearch("");
    setOrganizationFilter("ALL");
    setTechnicalUnitFilter("ALL");
    setSubTechnicalUnitFilter("ALL");
    setWorkCategoryFilter("ALL");
    setFinancialYearFilter("ALL");
    setInfraLifecycleFilter("ALL");
    setSelectedInfraProjectId(null);
    setSelectedProjectId(null);
    setChartProjectId(null);
  };

  const refreshAll = async () => {
    resetFilters();
    await Promise.all([refetchProjects(), refetchTasks(), refetchFinancial(), refetchInfraProjects()]);
    toast.success("Refreshed — all filters cleared");
  };

  const selectInfraSubUnit = (code: string) => {
    setTechnicalUnitFilter("S");
    setSubTechnicalUnitFilter(code);
    setInfraLifecycleFilter("ALL");
    setSelectedInfraProjectId(null);
  };

  const isLoading = loadingProjects || loadingTasks || loadingFinancial;
  const projectTableColSpan = 11;

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">HOD Dashboard</h1>
          <p className="page-subtitle">Executive view of project progress and task activity (read-only).</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void refreshAll()}
          title="Clear all filters and reload data"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="glass-panel p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          <FilterField label="Organization">
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All organizations</SelectItem>
                {HOD_COMPANY_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Technical Unit">
            <Select
              value={technicalUnitFilter}
              onValueChange={(value) => {
                setTechnicalUnitFilter(value);
                setSubTechnicalUnitFilter("ALL");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All technical units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All technical units</SelectItem>
                {HOD_TECHNICAL_UNIT_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Sub Technical Unit">
            <Select
              value={subTechnicalUnitFilter}
              onValueChange={(value) => {
                setSubTechnicalUnitFilter(value);
                setInfraLifecycleFilter("ALL");
                setSelectedInfraProjectId(null);
                setSelectedProjectId(null);
              }}
              disabled={technicalUnitFilter === "ALL"}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    technicalUnitFilter === "ALL" ? "Select technical unit first" : "All sub technical units"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sub technical units</SelectItem>
                {subTechnicalOptions.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Work Category">
            <Select value={workCategoryFilter} onValueChange={setWorkCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All work categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All work categories</SelectItem>
                {workCategoryOptions.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label} ({item.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Financial Year">
            <Select
              value={financialYearFilter}
              onValueChange={setFinancialYearFilter}
              disabled={financialYearOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    financialYearOptions.length === 0 ? "No financial years in projects" : "All financial years"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All financial years</SelectItem>
                {financialYearOptions.map((fy) => (
                  <SelectItem key={fy} value={String(fy)}>
                    {formatHodFinancialYearLabel(fy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Search" className="2xl:col-span-1 md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Project name or number"
                className="pl-10"
              />
            </div>
          </FilterField>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Section follows project number: pick Technical Unit → Sub Unit.{" "}
            <span className="font-medium text-foreground">IE / AE / PM / TP</span> opens Infra monitoring; other units open DPR monitoring.
          </p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </div>

      {technicalUnitFilter === "S" && subTechnicalUnitFilter === "ALL" ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 mb-6 text-sm">
          You selected <strong>Supervision Consultancy</strong>. Choose a sub unit to open the right section:{" "}
          <button type="button" className="text-primary underline font-medium" onClick={() => selectInfraSubUnit("IE")}>IE</button>
          {", "}
          <button type="button" className="text-primary underline font-medium" onClick={() => selectInfraSubUnit("AE")}>AE</button>
          {", "}
          <button type="button" className="text-primary underline font-medium" onClick={() => selectInfraSubUnit("PM")}>PM</button>
          {", "}
          <button type="button" className="text-primary underline font-medium" onClick={() => selectInfraSubUnit("TP")}>TP</button>
          {" for Infra (only that unit’s projects) · or PC / FH / RS etc. for DPR."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {isInfraSection ? (
          <>
            <KpiCard label={`${subTechnicalUnitFilter} Projects`} value={infraTotals.total} icon={FolderKanban} tone="text-primary bg-primary/10" />
            <KpiCard label="Completed" value={infraTotals.completed} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
            <KpiCard label="Ongoing" value={infraTotals.ongoing} icon={Timer} tone="text-amber-600 bg-amber-500/10" />
          </>
        ) : (
          <>
            <KpiCard label="Total Projects" value={totals.total} icon={FolderKanban} tone="text-primary bg-primary/10" />
            <KpiCard label="Completed Projects" value={totals.completed} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
            <KpiCard label="Ongoing Projects" value={totals.ongoing} icon={Timer} tone="text-amber-600 bg-amber-500/10" />
          </>
        )}
      </div>

      {isInfraSection ? (
      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Infra Monitoring · {subTechnicalUnitFilter}</h3>
            <p className="text-sm text-muted-foreground">
              Projects with sub-unit <strong>{subTechnicalUnitFilter}</strong> from the project number (Supervision). Filtered by the selectors above.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full self-start">
            {infraOverview?.teamMembers ?? 0} team members · {infraTeam.filter((m) => m.mobilizedAt && !m.demobilizedAt).length}{" "}
            mobilized
          </Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <button type="button" className="text-left" onClick={() => setInfraLifecycleFilter("ALL")}>
            <MiniStat label="Showing" value={infraTotals.total} />
          </button>
          <button type="button" className="text-left" onClick={() => setInfraLifecycleFilter("ONGOING")}>
            <MiniStat label="Ongoing" value={infraTotals.ongoing} />
          </button>
          <button type="button" className="text-left" onClick={() => setInfraLifecycleFilter("COMPLETED")}>
            <MiniStat label="Completed" value={infraTotals.completed} />
          </button>
          <MiniStat label="Mobilized (all infra)" value={infraOverview?.mobilizedTeamMembers ?? 0} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <MiniStat label="Actual Given" value={infraTotals.totalActual} isCurrency />
          <MiniStat label="Drawn (Govt.)" value={infraTotals.totalDrawn} isCurrency />
          <MiniStat label="Profit / Loss" value={infraTotals.totalProfitLoss} isCurrency />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={infraLifecycleFilter} onValueChange={setInfraLifecycleFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="rounded-full self-center">
            {filteredInfraProjects.length} {subTechnicalUnitFilter} project(s)
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 ml-auto"
            onClick={() => {
              void downloadInfraProjectsSummaryPdf(
                filteredInfraProjects.map((project, index) => ({
                  sr: index + 1,
                  projectName: project.name,
                  projectNumber: project.projectNumber || "",
                  unitCode: project.subTechnicalUnitCode,
                  totalAmount: project.totalActualAmount ?? 0,
                  totalDrawnAmount: project.totalDrawnAmount ?? 0,
                  totalProfitLoss: project.totalProfitLoss ?? 0
                }))
              )
                .then(() => toast.success("Infra summary PDF downloaded"))
                .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to download PDF"));
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Summary PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              try {
                downloadInfraProjectsSummaryExcel(
                  filteredInfraProjects.map((project, index) => ({
                    sr: index + 1,
                    projectName: project.name,
                    projectNumber: project.projectNumber || "",
                    unitCode: project.subTechnicalUnitCode,
                    totalAmount: project.totalActualAmount ?? 0,
                    totalDrawnAmount: project.totalDrawnAmount ?? 0,
                    totalProfitLoss: project.totalProfitLoss ?? 0
                  }))
                );
                toast.success("Infra summary Excel downloaded");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to download Excel");
              }
            }}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Summary Excel
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-3 pr-4 text-left font-medium">Project Number</th>
                <th className="py-3 px-4 text-left font-medium">Project Name</th>
                <th className="py-3 px-4 text-left font-medium">Unit</th>
                <th className="py-3 px-4 text-left font-medium">Lifecycle</th>
                <th className="py-3 px-4 text-right font-medium">Active Staff</th>
                <th className="py-3 px-4 text-right font-medium">Actual</th>
                <th className="py-3 px-4 text-right font-medium">Drawn</th>
                <th className="py-3 px-4 text-right font-medium">P/L</th>
                <th className="py-3 pl-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingInfraProjects ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading infra projects...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!loadingInfraProjects && filteredInfraProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No {activeInfraUnit} projects match the selected filters.
                  </td>
                </tr>
              ) : null}
              {!loadingInfraProjects
                ? filteredInfraProjects.map((project: InfraProjectItem) => (
                    <tr key={project.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pr-4 font-medium">{project.projectNumber || "-"}</td>
                      <td className="py-3 px-4 max-w-[260px] truncate">{project.name}</td>
                      <td className="py-3 px-4"><Badge variant="outline">{project.subTechnicalUnitCode || "-"}</Badge></td>
                      <td className="py-3 px-4"><Badge>{project.lifecycle}</Badge></td>
                      <td className="py-3 px-4 text-right tabular-nums">{project.activeAssignments}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(project.totalActualAmount ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(project.totalDrawnAmount ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(project.totalProfitLoss ?? 0)}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              void downloadInfraProjectBillPdf({
                                projectName: project.name,
                                projectNumber: project.projectNumber || "",
                                unitCode: project.subTechnicalUnitCode,
                                lines: project.assignments.map((assignment, index) => ({
                                  sr: index + 1,
                                  name: assignment.teamMember.name,
                                  email: assignment.teamMember.email || "",
                                  role: assignment.teamMember.manpowerRole,
                                  monthlyCost: assignment.teamMember.monthlyCost ?? null,
                                  daysWorked: assignment.daysWorked ?? null,
                                  amount: assignment.amount ?? 0,
                                  actualAmount: assignment.actualAmount ?? null,
                                  drawnAmount: assignment.drawnAmount ?? null,
                                  profitLoss: assignment.profitLoss ?? 0
                                })),
                                otherCosts: (project.infraOtherCosts ?? []).map((cost, index) => ({
                                  sr: index + 1,
                                  description: cost.description,
                                  actualAmount: cost.actualAmount ?? null,
                                  drawnAmount: cost.drawnAmount ?? null,
                                  profitLoss: cost.profitLoss ?? 0
                                })),
                                totalAmount: project.totalCost ?? 0,
                                totalActualAmount: project.totalActualAmount ?? 0,
                                totalDrawnAmount: project.totalDrawnAmount ?? 0,
                                totalProfitLoss: project.totalProfitLoss ?? 0
                              })
                                .then(() => toast.success("Project bill PDF downloaded"))
                                .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to download PDF"));
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedInfraProjectId(project.id)}>
                            <Eye className="h-3.5 w-3.5" />
                            View Team
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
      <>
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-lg">DPR Project monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Task activity from DPR Admin; financial progress from DPR Financial. Filtered by project number section above.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {projectRows.length} project(s)
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1280px]">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-3 pr-4 text-left font-medium">Project Number</th>
                <th className="py-3 px-4 text-left font-medium">Project Name</th>
                <th className="py-3 px-4 text-right font-medium">WO Amt (Excl. GST)</th>
                <th className="py-3 px-4 text-right font-medium">Received Amount</th>
                <th className="py-3 px-4 text-right font-medium">Financial Progress (%)</th>
                <th className="py-3 px-4 text-right font-medium">Billing Amount</th>
                <th className="py-3 px-4 text-right font-medium">Tasks</th>
                <th className="py-3 px-4 text-right font-medium">Under Preparation</th>
                <th className="py-3 px-4 text-right font-medium">Draft Submitted</th>
                <th className="py-3 px-4 text-right font-medium">Approved</th>
                <th className="py-3 pl-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={projectTableColSpan} className="py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading projects, tasks, and financial data...
                    </span>
                  </td>
                </tr>
              ) : null}

              {!isLoading && projectRows.length === 0 ? (
                <tr>
                  <td colSpan={projectTableColSpan} className="py-10 text-center text-muted-foreground">
                    No projects match the selected filters.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? projectRows.map((row) => (
                    <tr key={row.project.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pr-4 font-medium">{row.project.projectNumber || "-"}</td>
                      <td className="py-3 px-4 max-w-[240px] truncate">{row.project.name}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(row.woAmountExclGst)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(row.receivedAmountExclGst)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodPercent(row.financialProgressPct)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatHodCurrency(row.billingAmount)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{row.summary.total}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-amber-700">{row.summary.pending}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-sky-600">{row.summary.completed}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-600">{row.summary.approved}</td>
                      <td className="py-3 pl-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setChartProjectId(row.project.id)}
                            disabled={row.projectTasks.length === 0}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Chart
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedProjectId(row.project.id)}>
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-4 inline-flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5" />
          Completed = all tasks on the project are marked done in DPR Admin.
        </p>
      </div>

      <HodDprOverviewSection projects={filteredProjects} tasks={tasks} isLoading={isLoading} />
      </>
      )}

      <HodProjectDetailDialog
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
        project={selectedRow?.project ?? null}
        projectTasks={selectedRow?.projectTasks ?? []}
        onOpenActivityChart={() => {
          if (selectedRow) {
            setChartProjectId(selectedRow.project.id);
          }
        }}
      />

      <HodInfraProjectDetailDialog
        open={Boolean(selectedInfraProject)}
        onOpenChange={(open) => {
          if (!open) setSelectedInfraProjectId(null);
        }}
        project={selectedInfraProject}
      />

      <HodActivityChartDialog
        open={Boolean(chartRow)}
        onOpenChange={(open) => {
          if (!open) setChartProjectId(null);
        }}
        project={chartRow?.project ?? null}
        projectTasks={chartRow?.projectTasks ?? []}
      />
    </PageWrapper>
  );
}

function FilterField({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone
}: {
  label: string;
  value: number;
  icon: typeof FolderKanban;
  tone: string;
}) {
  return (
    <div className="kpi-card">
      <div className={`p-2.5 rounded-xl ${tone} w-fit mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, isCurrency = false }: { label: string; value: number; isCurrency?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{isCurrency ? formatHodCurrency(value) : value}</p>
    </div>
  );
}
