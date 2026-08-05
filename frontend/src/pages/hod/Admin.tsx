import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportButtons } from "@/components/ExportButtons";
import { HodProjectDetailDialog } from "@/components/hod/HodProjectDetailDialog";
import { api } from "@/lib/api";
import { ASSET_CLASS_OPTIONS } from "@/lib/asset-catalog";
import type { AssetItem, AssetStatus, ProjectItem } from "@/lib/domain";
import {
  collectHodFinancialYearOptions,
  compareHodProjectsByNumber,
  formatHodCurrency,
  formatHodFinancialYearLabel,
  getAllHodWorkCategoryOptions,
  getHodWorkCategoryOptions,
  getProjectCompanyCode,
  getProjectFinancialYearShort,
  getProjectLifecycle,
  getProjectSubTechnicalUnitCode,
  getProjectTechnicalUnitCode,
  getProjectWorkCategoryCode,
  getTasksForProject,
  HOD_COMPANY_OPTIONS,
  HOD_SUB_TECHNICAL_UNIT_OPTIONS,
  HOD_TECHNICAL_UNIT_OPTIONS,
  summarizeProjectTasks
} from "@/lib/hod-dashboard";
import { downloadTableExcel, downloadTablePdf, type TableExportColumn } from "@/lib/table-export";
import { useQuery } from "@tanstack/react-query";
import { Eye, FolderKanban, Loader2, Package, RefreshCcw, Search, X } from "lucide-react";

type AdminTab = "assets" | "projects";

const STATUS_OPTIONS: Array<{ label: string; value: AssetStatus | "ALL" }> = [
  { label: "All statuses", value: "ALL" },
  { label: "In Use", value: "IN_USE" },
  { label: "In Store", value: "IN_STORE" },
  { label: "Under Repair", value: "UNDER_REPAIR" },
  { label: "Disposed", value: "DISPOSED" }
];

function statusBadgeVariant(status: AssetStatus) {
  if (status === "IN_USE") return "secondary" as const;
  if (status === "IN_STORE") return "outline" as const;
  if (status === "UNDER_REPAIR") return "destructive" as const;
  return "outline" as const;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

type ProjectAssetGroup = {
  key: string;
  projectNumber: string;
  projectName: string;
  assets: AssetItem[];
};

export default function HodAdmin() {
  const [tab, setTab] = useState<AdminTab>("assets");
  const [search, setSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("ALL");
  const [technicalUnitFilter, setTechnicalUnitFilter] = useState("ALL");
  const [subTechnicalUnitFilter, setSubTechnicalUnitFilter] = useState("ALL");
  const [workCategoryFilter, setWorkCategoryFilter] = useState("ALL");
  const [financialYearFilter, setFinancialYearFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");
  const [assetClassFilter, setAssetClassFilter] = useState("ALL");
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const {
    data: assetsResponse,
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ["hod-assets"],
    queryFn: () => api.getAssets({ page: 1, limit: 2000 }),
    staleTime: 2 * 60 * 1000
  });

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

  const assets = assetsResponse?.items ?? [];
  const tasks = tasksResponse?.items ?? [];

  const subUnitOptions = useMemo(() => {
    if (technicalUnitFilter === "ALL") {
      return Object.values(HOD_SUB_TECHNICAL_UNIT_OPTIONS).flat();
    }
    return HOD_SUB_TECHNICAL_UNIT_OPTIONS[technicalUnitFilter] ?? [];
  }, [technicalUnitFilter]);

  const workCategoryOptions = useMemo(() => {
    if (subTechnicalUnitFilter !== "ALL") {
      return getHodWorkCategoryOptions(subTechnicalUnitFilter);
    }
    return getAllHodWorkCategoryOptions();
  }, [subTechnicalUnitFilter]);

  const financialYearOptions = useMemo(() => {
    const fromAssets = assets
      .filter((asset) => asset.projectNumber)
      .map((asset) => ({ name: asset.projectName || "", projectNumber: asset.projectNumber }));
    return collectHodFinancialYearOptions([...fromAssets, ...projects] as ProjectItem[]);
  }, [assets, projects]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const projectRef = {
        name: asset.projectName || "",
        projectNumber: asset.projectNumber
      };

      if (organizationFilter !== "ALL" && getProjectCompanyCode(projectRef) !== organizationFilter) {
        return false;
      }
      if (
        technicalUnitFilter !== "ALL" &&
        getProjectTechnicalUnitCode(projectRef) !== technicalUnitFilter
      ) {
        return false;
      }
      if (
        subTechnicalUnitFilter !== "ALL" &&
        getProjectSubTechnicalUnitCode(projectRef) !== subTechnicalUnitFilter
      ) {
        return false;
      }
      if (
        workCategoryFilter !== "ALL" &&
        getProjectWorkCategoryCode(projectRef) !== workCategoryFilter
      ) {
        return false;
      }
      const fy = getProjectFinancialYearShort(projectRef);
      if (financialYearFilter !== "ALL" && String(fy ?? "") !== financialYearFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && asset.status !== statusFilter) return false;
      if (assetClassFilter !== "ALL" && asset.assetClass !== assetClassFilter) return false;

      if (!q) return true;
      const haystack = [
        asset.assetId,
        asset.itAssetId,
        asset.assetClass,
        asset.assetType,
        asset.markModel,
        asset.projectNumber,
        asset.projectName,
        asset.assignedUser,
        asset.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    assets,
    search,
    organizationFilter,
    technicalUnitFilter,
    subTechnicalUnitFilter,
    workCategoryFilter,
    financialYearFilter,
    statusFilter,
    assetClassFilter
  ]);

  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectAssetGroup>();
    for (const asset of filteredAssets) {
      const projectNumber = asset.projectNumber?.trim() || "UNASSIGNED";
      const projectName = asset.projectName?.trim() || (projectNumber === "UNASSIGNED" ? "No project assigned" : "—");
      const key = `${projectNumber}|||${projectName}`;
      const existing = map.get(key);
      if (existing) {
        existing.assets.push(asset);
      } else {
        map.set(key, {
          key,
          projectNumber,
          projectName,
          assets: [asset]
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.projectNumber === "UNASSIGNED") return 1;
      if (b.projectNumber === "UNASSIGNED") return -1;
      return a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true });
    });
  }, [filteredAssets]);

  const assetAmountTotals = useMemo(() => {
    return filteredAssets.reduce(
      (acc, asset) => ({
        purchase: acc.purchase + (Number(asset.totalAmountWithGst ?? asset.purchaseAmount) || 0),
        current: acc.current + (Number(asset.currentValue) || 0),
      }),
      { purchase: 0, current: 0 }
    );
  }, [filteredAssets]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (organizationFilter !== "ALL" && getProjectCompanyCode(project) !== organizationFilter) return false;
        if (technicalUnitFilter !== "ALL" && getProjectTechnicalUnitCode(project) !== technicalUnitFilter) return false;
        if (subTechnicalUnitFilter !== "ALL" && getProjectSubTechnicalUnitCode(project) !== subTechnicalUnitFilter) {
          return false;
        }
        if (workCategoryFilter !== "ALL" && getProjectWorkCategoryCode(project) !== workCategoryFilter) return false;
        const fy = getProjectFinancialYearShort(project);
        if (financialYearFilter !== "ALL" && String(fy ?? "") !== financialYearFilter) return false;
        if (!q) return true;
        return [project.name, project.projectNumber, project.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort(compareHodProjectsByNumber);
  }, [
    projects,
    search,
    organizationFilter,
    technicalUnitFilter,
    subTechnicalUnitFilter,
    workCategoryFilter,
    financialYearFilter
  ]);

  const projectRows = useMemo(() => {
    return filteredProjects.map((project) => {
      const projectTasks = getTasksForProject(project, tasks);
      const summary = summarizeProjectTasks(projectTasks);
      const lifecycle = getProjectLifecycle(projectTasks);
      return { project, projectTasks, summary, lifecycle };
    });
  }, [filteredProjects, tasks]);

  const selectedProjectRow = selectedProjectId
    ? projectRows.find((row) => row.project.id === selectedProjectId) ?? null
    : null;

  const assetExportColumns: TableExportColumn<AssetItem>[] = useMemo(
    () => [
      { header: "Asset ID", value: (a) => a.assetId || a.itAssetId },
      { header: "Class", value: (a) => a.assetClass },
      { header: "Type", value: (a) => a.assetType },
      { header: "Model", value: (a) => a.markModel },
      { header: "User", value: (a) => a.assignedUser },
      { header: "Status", value: (a) => a.status },
      { header: "Project Number", value: (a) => a.projectNumber },
      { header: "Project Name", value: (a) => a.projectName },
      { header: "Purchase", value: (a) => a.totalAmountWithGst ?? a.purchaseAmount },
      { header: "Current Value", value: (a) => a.currentValue },
    ],
    []
  );

  const projectExportColumns: TableExportColumn<(typeof projectRows)[number]>[] = useMemo(
    () => [
      { header: "Project Number", value: (r) => r.project.projectNumber },
      { header: "Project Name", value: (r) => r.project.name },
      { header: "Lifecycle", value: (r) => r.lifecycle },
      { header: "Tasks", value: (r) => r.summary.total },
      { header: "Approved", value: (r) => r.summary.approved },
      { header: "Pending", value: (r) => r.summary.pending },
      { header: "Completed", value: (r) => r.summary.completed },
    ],
    []
  );

  const clearFilters = () => {
    setSearch("");
    setOrganizationFilter("ALL");
    setTechnicalUnitFilter("ALL");
    setSubTechnicalUnitFilter("ALL");
    setWorkCategoryFilter("ALL");
    setFinancialYearFilter("ALL");
    setStatusFilter("ALL");
    setAssetClassFilter("ALL");
  };

  const refreshAll = () => {
    void refetch();
    void refetchProjects();
    void refetchTasks();
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title inline-flex items-center gap-2">
            <Package className="h-6 w-6" />
            Admin
          </h1>
          <p className="page-subtitle">
            Assets and project details — filter by project number structure (read-only).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">
            {tab === "assets"
              ? `Showing ${filteredAssets.length} of ${assets.length}`
              : `Showing ${filteredProjects.length} of ${projects.length}`}
          </Badge>
          {tab === "assets" ? (
            <Badge variant="outline" className="rounded-full">
              {projectGroups.length} project group(s)
            </Badge>
          ) : null}
          {tab === "assets" ? (
            <ExportButtons
              disabled={filteredAssets.length === 0}
              onExcel={() =>
                downloadTableExcel({
                  filename: `HOD-Assets-${new Date().toISOString().slice(0, 10)}`,
                  sheetName: "Assets",
                  title: "HOD Admin — Assets (filtered)",
                  columns: assetExportColumns,
                  rows: filteredAssets,
                })
              }
              onPdf={() =>
                downloadTablePdf({
                  filename: `HOD-Assets-${new Date().toISOString().slice(0, 10)}`,
                  title: "HOD Admin — Assets",
                  subtitle: "Filtered rows",
                  columns: assetExportColumns,
                  rows: filteredAssets,
                  landscape: true,
                })
              }
            />
          ) : (
            <ExportButtons
              disabled={projectRows.length === 0}
              onExcel={() =>
                downloadTableExcel({
                  filename: `HOD-Projects-${new Date().toISOString().slice(0, 10)}`,
                  sheetName: "Projects",
                  title: "HOD Admin — Projects (filtered)",
                  columns: projectExportColumns,
                  rows: projectRows,
                })
              }
              onPdf={() =>
                downloadTablePdf({
                  filename: `HOD-Projects-${new Date().toISOString().slice(0, 10)}`,
                  title: "HOD Admin — Projects",
                  subtitle: "Filtered rows",
                  columns: projectExportColumns,
                  rows: projectRows,
                })
              }
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={isFetching || loadingProjects || loadingTasks}
            onClick={refreshAll}
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-secondary/40 rounded-lg w-fit mb-4">
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
            tab === "assets" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("assets")}
        >
          <Package className="h-4 w-4" /> Assets
          <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0">{filteredAssets.length}</Badge>
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
            tab === "projects" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("projects")}
        >
          <FolderKanban className="h-4 w-4" /> Projects
          <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0">{filteredProjects.length}</Badge>
        </button>
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Asset ID, project no., user, class..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Organization</label>
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {HOD_COMPANY_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Technical Unit</label>
            <Select
              value={technicalUnitFilter}
              onValueChange={(value) => {
                setTechnicalUnitFilter(value);
                setSubTechnicalUnitFilter("ALL");
                setWorkCategoryFilter("ALL");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Technical Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {HOD_TECHNICAL_UNIT_OPTIONS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Sub Technical Unit</label>
            <Select
              value={subTechnicalUnitFilter}
              onValueChange={(value) => {
                setSubTechnicalUnitFilter(value);
                setWorkCategoryFilter("ALL");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="e.g. TP / IE" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {subUnitOptions.map((item) => (
                  <SelectItem key={`${item.code}-${item.label}`} value={item.code}>
                    {item.code} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Work Category</label>
            <Select value={workCategoryFilter} onValueChange={setWorkCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Work Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {workCategoryOptions.map((item) => (
                  <SelectItem key={`${item.code}-${item.label}`} value={item.code}>
                    {item.code} — {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Financial Year</label>
            <Select value={financialYearFilter} onValueChange={setFinancialYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="FY" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {financialYearOptions.map((fy) => (
                  <SelectItem key={fy} value={String(fy)}>
                    {formatHodFinancialYearLabel(fy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tab === "assets" ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as AssetStatus | "ALL")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Asset Class</label>
                <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Asset Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {ASSET_CLASS_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        </div>
      </div>

      {tab === "assets" ? (
        isLoading ? (
          <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading assets...
          </div>
        ) : projectGroups.length === 0 ? (
          <div className="glass-panel p-10 text-center text-muted-foreground">
            No assets match the selected filters.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-panel p-3 flex flex-wrap gap-3 text-xs font-semibold">
              <span>Filtered totals:</span>
              <span>Purchase {formatHodCurrency(assetAmountTotals.purchase)}</span>
              <span>Current value {formatHodCurrency(assetAmountTotals.current)}</span>
            </div>
            {projectGroups.map((group) => (
              <div key={group.key} className="glass-panel overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 bg-secondary/20 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {group.projectNumber === "UNASSIGNED" ? "Unassigned / In Store" : group.projectNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">{group.projectName}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {group.assets.length} asset(s)
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left font-medium p-3">Asset ID</th>
                        <th className="text-left font-medium p-3">Class</th>
                        <th className="text-left font-medium p-3">Type</th>
                        <th className="text-left font-medium p-3">Model</th>
                        <th className="text-left font-medium p-3">User</th>
                        <th className="text-left font-medium p-3">Status</th>
                        <th className="text-right font-medium p-3">Purchase</th>
                        <th className="text-right font-medium p-3">Current Value</th>
                        <th className="text-right font-medium p-3"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.assets.map((asset) => (
                        <tr key={asset.id} className="border-b border-border/20 hover:bg-secondary/20">
                          <td className="p-3 font-medium">{asset.assetId || asset.itAssetId || "—"}</td>
                          <td className="p-3">{asset.assetClass || "—"}</td>
                          <td className="p-3">{asset.assetType || "—"}</td>
                          <td className="p-3 max-w-[180px] truncate" title={asset.markModel ?? undefined}>
                            {asset.markModel || "—"}
                          </td>
                          <td className="p-3">{asset.assignedUser || "—"}</td>
                          <td className="p-3">
                            <Badge variant={statusBadgeVariant(asset.status)}>{asset.status.replaceAll("_", " ")}</Badge>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {formatHodCurrency(asset.totalAmountWithGst ?? asset.purchaseAmount ?? 0)}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {formatHodCurrency(asset.currentValue ?? 0)}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7"
                              onClick={() => setSelectedAsset(asset)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      ) : loadingProjects || loadingTasks ? (
        <div className="glass-panel p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
        </div>
      ) : projectRows.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted-foreground">
          No projects match the selected filters.
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left font-medium p-3">Project Number</th>
                  <th className="text-left font-medium p-3">Project Name</th>
                  <th className="text-left font-medium p-3">Lifecycle</th>
                  <th className="text-right font-medium p-3">Tasks</th>
                  <th className="text-right font-medium p-3">Approved</th>
                  <th className="text-right font-medium p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr key={row.project.id} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="p-3 font-medium">{row.project.projectNumber || "—"}</td>
                    <td className="p-3 max-w-[280px] truncate">{row.project.name}</td>
                    <td className="p-3">
                      <Badge variant="outline">{row.lifecycle}</Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.summary.total}</td>
                    <td className="p-3 text-right tabular-nums">{row.summary.approved}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7"
                        onClick={() => setSelectedProjectId(row.project.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedAsset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border/40 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Asset details (read-only)</p>
                <p className="text-xs text-muted-foreground">{selectedAsset.assetId}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedAsset(null)}>
                Close
              </Button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Asset ID", selectedAsset.assetId],
                  ["IT Asset ID", selectedAsset.itAssetId],
                  ["Class", selectedAsset.assetClass],
                  ["Type", selectedAsset.assetType],
                  ["Mark / Model", selectedAsset.markModel],
                  ["Status", selectedAsset.status.replaceAll("_", " ")],
                  ["Project Number", selectedAsset.projectNumber],
                  ["Project Name", selectedAsset.projectName],
                  ["Assigned User", selectedAsset.assignedUser],
                  ["Assigned Date", formatDate(selectedAsset.assignedDate)],
                  ["Purchase Date", formatDate(selectedAsset.dateOfPurchase)],
                  ["Warranty End", formatDate(selectedAsset.warrantyPeriod)],
                  ["Purchase Amount", formatHodCurrency(selectedAsset.purchaseAmount ?? 0)],
                  ["GST", formatHodCurrency(selectedAsset.gst ?? 0)],
                  ["Total with GST", formatHodCurrency(selectedAsset.totalAmountWithGst ?? 0)],
                  ["Current Value", formatHodCurrency(selectedAsset.currentValue ?? 0)],
                  ["Sold Amount", formatHodCurrency(selectedAsset.soldAmount ?? 0)],
                  ["Remarks", selectedAsset.remarks]
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 break-words">{value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <HodProjectDetailDialog
        open={Boolean(selectedProjectRow)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
        project={selectedProjectRow?.project ?? null}
        projectTasks={selectedProjectRow?.projectTasks ?? []}
      />
    </PageWrapper>
  );
}
