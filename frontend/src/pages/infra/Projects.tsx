import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Loader2, Plus, Search, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";

const INFRA_CODES = ["IE", "AE", "PM", "TP"] as const;

export default function InfraProjects() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState<string>(searchParams.get("unit") ?? "ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>(searchParams.get("lifecycle") ?? "ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(searchParams.get("open"));
  const [teamMemberId, setTeamMemberId] = useState("");
  const [mobilizedAt, setMobilizedAt] = useState(new Date().toISOString().slice(0, 10));
  const [demobilizedAt, setDemobilizedAt] = useState(new Date().toISOString().slice(0, 10));

  const { data: projects = [], isLoading } = useQuery({ queryKey: ["infra-projects"], queryFn: () => api.getInfraProjects() });
  const { data: team = [] } = useQuery({ queryKey: ["infra-team"], queryFn: () => api.getInfraTeamMembers() });
  const { data: selectedProject } = useQuery({
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

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!mobilizedAt) throw new Error("Please select mobilization date");
      return api.assignInfraProject(selectedProjectId!, {
        teamMemberId,
        mobilizedAt: new Date(`${mobilizedAt}T00:00:00`).toISOString()
      });
    },
    onSuccess: async () => {
      toast.success("Employee mobilized to project");
      setTeamMemberId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["infra-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-project", selectedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["infra-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-team"] })
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to assign project")
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["infra-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-project", selectedProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["infra-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["infra-team"] })
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to demobilize")
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

  const closeDetails = () => {
    setSelectedProjectId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next);
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
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelectedProjectId(project.id)}>
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

      {selectedProject && selectedProjectId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={closeDetails}>
          <div className="w-full max-w-2xl bg-card border-l border-border h-full overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Project Details</h3>
                <p className="text-sm text-muted-foreground">{selectedProject.projectNumber || "No project number"}</p>
              </div>
              <button aria-label="Close" onClick={closeDetails} className="p-1.5 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-3 mb-6">
              <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium mt-1">{selectedProject.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <p className="text-xs text-muted-foreground">Sub Technical Unit</p>
                  <p className="font-medium mt-1">{selectedProject.subTechnicalUnitCode || "-"}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <p className="text-xs text-muted-foreground">Active Assignments</p>
                  <p className="font-medium mt-1">{selectedProject.activeAssignments}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 mb-6 space-y-3">
              <h4 className="font-semibold">Assign / Mobilize Employee</h4>
              <Select value={teamMemberId} onValueChange={setTeamMemberId}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.manpowerRole})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <label htmlFor="mobilize-date" className="text-xs text-muted-foreground mb-1.5 block">Mobilized Date *</label>
                <Input id="mobilize-date" type="date" value={mobilizedAt} onChange={(e) => setMobilizedAt(e.target.value)} required />
              </div>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!teamMemberId || !mobilizedAt || assignMutation.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {assignMutation.isPending ? "Saving..." : "Assign / Mobilize"}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">Assigned Team</h4>
                <div>
                  <label htmlFor="demobilize-date" className="sr-only">Demobilize date</label>
                  <Input id="demobilize-date" type="date" value={demobilizedAt} onChange={(e) => setDemobilizedAt(e.target.value)} className="w-[160px]" />
                </div>
              </div>
              {selectedProject.assignments.length === 0 ? <p className="text-sm text-muted-foreground">No assignments yet.</p> : null}
              {selectedProject.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{assignment.teamMember.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{assignment.teamMember.manpowerGroup} · {assignment.teamMember.manpowerRole}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mobilized: {assignment.mobilizedAt ? new Date(assignment.mobilizedAt).toLocaleDateString("en-IN") : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demobilized: {assignment.demobilizedAt ? new Date(assignment.demobilizedAt).toLocaleDateString("en-IN") : "-"}
                    </p>
                  </div>
                  {!assignment.demobilizedAt ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1"
                      disabled={demobilizeMutation.isPending || !demobilizedAt}
                      onClick={() => demobilizeMutation.mutate(assignment.id)}
                    >
                      <UserRoundCheck className="h-3.5 w-3.5" />
                      Demobilize
                    </Button>
                  ) : (
                    <Badge variant="outline">Closed</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
