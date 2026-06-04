import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HodDprOverviewSection } from "@/components/hod/HodDprOverviewSection";
import { HodProjectDetailDialog } from "@/components/hod/HodProjectDetailDialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinancialProjectBillStatusRow, ProjectItem } from "@/lib/domain";
import {
  formatHodCurrency,
  formatHodPercent,
  getCompanyLabel,
  getProjectCompanyCode,
  getProjectLifecycle,
  getTasksForProject,
  HOD_COMPANY_OPTIONS,
  HOD_SUB_TECHNICAL_UNIT_OPTIONS,
  HOD_TECHNICAL_UNIT_OPTIONS,
  summarizeProjectTasks
} from "@/lib/hod-dashboard";
import { CheckCircle2, ClipboardList, Eye, FolderKanban, Loader2, RefreshCcw, Search, Timer } from "lucide-react";

export default function HodDashboard() {
  const [search, setSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("ALL");
  const [technicalUnitFilter, setTechnicalUnitFilter] = useState("ALL");
  const [subTechnicalUnitFilter, setSubTechnicalUnitFilter] = useState("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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
      return Object.values(HOD_SUB_TECHNICAL_UNIT_OPTIONS).flat();
    }
    return HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitFilter] ?? [];
  }, [technicalUnitFilter]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return projects.filter((project) => {
      const companyCode = getProjectCompanyCode(project);
      const orgOk = organizationFilter === "ALL" || companyCode === organizationFilter;
      const unitOk = technicalUnitFilter === "ALL" || project.technicalUnitCode === technicalUnitFilter;
      const subOk = subTechnicalUnitFilter === "ALL" || project.subTechnicalUnitCode === subTechnicalUnitFilter;

      if (!orgOk || !unitOk || !subOk) {
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
  }, [organizationFilter, projects, search, subTechnicalUnitFilter, technicalUnitFilter]);

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
      .sort((a, b) => {
        const numberCompare = (a.project.projectNumber ?? "").localeCompare(b.project.projectNumber ?? "");
        if (numberCompare !== 0) return numberCompare;
        return a.project.name.localeCompare(b.project.name);
      });
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

  const resetFilters = () => {
    setSearch("");
    setOrganizationFilter("ALL");
    setTechnicalUnitFilter("ALL");
    setSubTechnicalUnitFilter("ALL");
  };

  const refreshAll = async () => {
    await Promise.all([refetchProjects(), refetchTasks(), refetchFinancial()]);
  };

  const isLoading = loadingProjects || loadingTasks || loadingFinancial;
  const projectTableColSpan = 12;

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">HOD Dashboard</h1>
          <p className="page-subtitle">Executive view of project progress and task activity (read-only).</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void refreshAll()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="glass-panel p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <FilterField label="Organization">
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All organizations</SelectItem>
                {HOD_COMPANY_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
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
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Sub Technical Unit">
            <Select value={subTechnicalUnitFilter} onValueChange={setSubTechnicalUnitFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All sub units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sub technical units</SelectItem>
                {subTechnicalOptions.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Search">
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

        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Projects" value={totals.total} icon={FolderKanban} tone="text-primary bg-primary/10" />
        <KpiCard label="Completed Projects" value={totals.completed} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
        <KpiCard label="Ongoing Projects" value={totals.ongoing} icon={Timer} tone="text-amber-600 bg-amber-500/10" />
      </div>

      <div className="glass-panel p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-lg">Project monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Task activity from DPR Admin assignments; financial progress and billing from DPR Admin Financial.
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
                <th className="py-3 px-4 text-left font-medium">Lifecycle</th>
                <th className="py-3 px-4 text-right font-medium">Tasks</th>
                <th className="py-3 px-4 text-right font-medium">Pending</th>
                <th className="py-3 px-4 text-right font-medium">Submitted</th>
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
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`rounded-full ${
                            row.lifecycle === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-amber-500/15 text-amber-700"
                          }`}
                        >
                          {row.lifecycle === "COMPLETED" ? "Completed" : "Ongoing"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{row.summary.total}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-amber-700">{row.summary.pending}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-sky-600">{row.summary.completed}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-600">{row.summary.approved}</td>
                      <td className="py-3 pl-4 text-right">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedProjectId(row.project.id)}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
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

      <HodProjectDetailDialog
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
        project={selectedRow?.project ?? null}
        projectTasks={selectedRow?.projectTasks ?? []}
      />
    </PageWrapper>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
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
