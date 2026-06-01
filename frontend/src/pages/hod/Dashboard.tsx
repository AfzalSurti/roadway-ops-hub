import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dprReportStatusConfig, type DprReportStatus, type ProjectDprOverviewItem, type ProjectItem } from "@/lib/domain";
import { ClipboardList, FolderKanban, Loader2, Search, Sparkles, TrendingUp, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { DprStatusModal } from "@/components/hod/DprStatusModal";

function shortDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getOverviewNote(overview: ProjectDprOverviewItem | null) {
  const data = overview?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const note = (data as { notes?: unknown }).notes;
  return typeof note === "string" ? note : "";
}

function statusTone(status?: DprReportStatus) {
  if (!status) return "text-muted-foreground bg-muted";
  return dprReportStatusConfig[status].color;
}

export default function HodDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["hod-projects"],
    queryFn: () => api.getProjects(),
    staleTime: 5 * 60 * 1000
  });

  const { data: overviews = [], isLoading: loadingOverviews } = useQuery({
    queryKey: ["hod-dpr-overviews"],
    queryFn: () => api.getProjectDprOverviews(),
    staleTime: 2 * 60 * 1000
  });

  const overviewByProjectId = useMemo(() => {
    return new Map(overviews.map((overview) => [overview.projectId, overview]));
  }, [overviews]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => {
      const overview = overviewByProjectId.get(project.id);
      const haystack = [
        project.name,
        project.projectNumber,
        project.description,
        overview?.status,
        getOverviewNote(overview)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [overviewByProjectId, projects, search]);

  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) ?? null : null;
  const selectedOverview = selectedProjectId ? overviewByProjectId.get(selectedProjectId) ?? null : null;

  const totals = useMemo(() => {
    const counts = {
      total: projects.length,
      overviewed: overviews.length,
      notStarted: 0,
      underPrep: 0,
      draftSubmitted: 0,
      underApproval: 0,
      approved: 0
    };

    for (const overview of overviews) {
      if (overview.status === "NOT_STARTED") counts.notStarted += 1;
      if (overview.status === "UNDER_PREPARATION") counts.underPrep += 1;
      if (overview.status === "DRAFT_SUBMITTED") counts.draftSubmitted += 1;
      if (overview.status === "UNDER_APPROVAL") counts.underApproval += 1;
      if (overview.status === "APPROVED") counts.approved += 1;
    }

    return counts;
  }, [overviews, projects.length]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { projectId: string; status: DprReportStatus; data: Record<string, unknown> | null }) => {
      const existing = overviewByProjectId.get(payload.projectId);
      if (existing) {
        return api.updateProjectDprOverview(existing.id, { status: payload.status, data: payload.data });
      }
      return api.createProjectDprOverview(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hod-dpr-overviews"] });
      toast.success("DPR status saved");
      setSelectedProjectId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save DPR status");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (overviewId: string) => api.deleteProjectDprOverview(overviewId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hod-dpr-overviews"] });
      toast.success("DPR status removed");
      setSelectedProjectId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete DPR status");
    }
  });

  const statusCards = [
    { label: "Total Projects", value: totals.total, icon: FolderKanban, tone: "text-primary bg-primary/10" },
    { label: "Projects with DPR", value: totals.overviewed, icon: ClipboardList, tone: "text-accent bg-accent/10" },
    { label: "Under Prep", value: totals.underPrep, icon: Sparkles, tone: "text-blue-400 bg-blue-400/10" },
    { label: "Under Approval", value: totals.underApproval, icon: TrendingUp, tone: "text-indigo-400 bg-indigo-400/10" },
    { label: "Approved", value: totals.approved, icon: CircleDollarSign, tone: "text-warning bg-warning/10" },
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">HOD Dashboard</h1>
        <p className="page-subtitle">Track DPR preparation, review, and approval status across projects.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {statusCards.map((card) => (
          <div key={card.label} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${card.tone} w-fit mb-3`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-semibold text-lg">Project DPR Overview</h3>
            <p className="text-sm text-muted-foreground">Create or update DPR status and working notes for each project.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or status" className="pl-10" />
            </div>
            <Button variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ["hod-dpr-overviews"] })}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-3 pr-4 text-left font-medium">Project</th>
                <th className="py-3 px-4 text-left font-medium">Project No.</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-left font-medium">Notes</th>
                <th className="py-3 px-4 text-left font-medium">Updated</th>
                <th className="py-3 pl-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(loadingProjects || loadingOverviews) && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading DPR data...
                    </span>
                  </td>
                </tr>
              )}

              {!loadingProjects && !loadingOverviews && filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">No projects found.</td>
                </tr>
              )}

              {filteredProjects.map((project) => {
                const overview = overviewByProjectId.get(project.id) ?? null;
                return (
                  <tr key={project.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pr-4 font-medium max-w-[260px] truncate">{project.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{project.projectNumber || "-"}</td>
                    <td className="py-3 px-4">
                      <Badge className={`rounded-full px-2.5 py-1 ${statusTone(overview?.status)}`} variant="secondary">
                        {overview ? dprReportStatusConfig[overview.status].label : "Not Started"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[320px] truncate">{getOverviewNote(overview) || "-"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{shortDate(overview?.updatedAt)}</td>
                    <td className="py-3 pl-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedProjectId(project.id)}>
                        {overview ? "Edit" : "Create"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DprStatusModal
        open={Boolean(selectedProject)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
        project={selectedProject}
        overview={selectedOverview}
        saving={saveMutation.isPending}
        deleting={deleteMutation.isPending}
        onSave={async (payload) => {
          await saveMutation.mutateAsync(payload);
        }}
        onDelete={async (overviewId) => {
          await deleteMutation.mutateAsync(overviewId);
        }}
      />
    </PageWrapper>
  );
}
