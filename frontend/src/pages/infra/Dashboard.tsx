import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Building2, CheckCircle2, FolderKanban, Timer, Users2 } from "lucide-react";

export default function InfraDashboard() {
  const navigate = useNavigate();
  const { data: overview } = useQuery({ queryKey: ["infra-overview"], queryFn: () => api.getInfraOverview() });
  const { data: projects = [] } = useQuery({ queryKey: ["infra-projects"], queryFn: () => api.getInfraProjects() });
  const { data: team = [] } = useQuery({ queryKey: ["infra-team"], queryFn: () => api.getInfraTeamMembers() });

  const kpis = useMemo(
    () => [
      {
        label: "Total Projects",
        value: overview?.totalProjects ?? 0,
        icon: FolderKanban,
        tone: "text-primary bg-primary/10",
        href: "/infra/projects?lifecycle=ALL"
      },
      {
        label: "Ongoing Projects",
        value: overview?.ongoingProjects ?? 0,
        icon: Timer,
        tone: "text-amber-600 bg-amber-500/10",
        href: "/infra/projects?lifecycle=ONGOING"
      },
      {
        label: "Completed Projects",
        value: overview?.completedProjects ?? 0,
        icon: CheckCircle2,
        tone: "text-emerald-600 bg-emerald-500/10",
        href: "/infra/projects?lifecycle=COMPLETED"
      },
      {
        label: "Team Members",
        value: overview?.teamMembers ?? 0,
        icon: Users2,
        tone: "text-blue-600 bg-blue-500/10",
        href: "/infra/team"
      }
    ],
    [overview]
  );

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Infra Dashboard</h1>
        <p className="page-subtitle">Operational overview for infra projects, team mobilization, and unit distribution.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => navigate(kpi.href)}
            className="kpi-card text-left hover:border-primary/40 transition-colors"
          >
            <div className={`p-2.5 rounded-xl ${kpi.tone} w-fit mb-3`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            <p className="text-[11px] text-primary mt-2">Click to view</p>
          </button>
        ))}
      </div>

      <div className="glass-panel p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Unit Split</h3>
            <p className="text-sm text-muted-foreground">Projects routed through IE, AE, PM, and TP only.</p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {overview?.mobilizedTeamMembers ?? 0} mobilized
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(overview?.byUnit ?? []).map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => navigate(`/infra/projects?unit=${item.code}`)}
              className="rounded-2xl border border-border/40 bg-secondary/20 p-4 text-left hover:border-primary/40 transition-colors"
            >
              <p className="text-xs text-muted-foreground">Sub Technical Unit</p>
              <p className="text-2xl font-bold mt-1">{item.code}</p>
              <p className="text-sm text-muted-foreground mt-1">{item.count} project(s)</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Recent Projects</h3>
            <Link to="/infra/projects" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/infra/projects?open=${project.id}`)}
                className="w-full text-left rounded-2xl border border-border/40 bg-secondary/20 p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{project.projectNumber || "No project number"}</p>
                  </div>
                  <Badge>{project.lifecycle}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {project.subTechnicalUnitCode ?? "-"} · {project.activeAssignments} active assignment(s)
                </p>
              </button>
            ))}
            {projects.length === 0 ? <p className="text-sm text-muted-foreground">No infra projects yet.</p> : null}
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Team Snapshot</h3>
            <Badge variant="outline">{team.length}</Badge>
          </div>
          <div className="space-y-3">
            {team.slice(0, 6).map((member) => (
              <div key={member.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="font-medium">{member.name}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {member.manpowerGroup} · {member.manpowerRole}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {member.currentProject ? `Mobilized on ${member.currentProject}` : "Not mobilized"}
                </p>
              </div>
            ))}
            {team.length === 0 ? <p className="text-sm text-muted-foreground">No team members yet.</p> : null}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
