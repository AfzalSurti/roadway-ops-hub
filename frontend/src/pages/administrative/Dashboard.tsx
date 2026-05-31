import { useMemo } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Building2, Layers3, Package, IndianRupee } from "lucide-react";

export default function AdministrativeDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const { data: stats } = useQuery({
    queryKey: ["assets", "stats"],
    queryFn: () => api.getAssetStats()
  });

  const kpis = useMemo(() => {
    const totalProjects = projects.length;
    const projectsWithAssets = stats?.projectsWithAssets ?? stats?.assetsWithProjectNumber ?? 0;
    return [
      { label: "Total Projects", value: totalProjects, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
      { label: "Projects with Assets", value: projectsWithAssets, icon: Layers3, color: "text-blue-400", bg: "bg-blue-400/10" },
      { label: "Total Assets", value: stats?.totalAssets ?? 0, icon: Package, color: "text-accent", bg: "bg-accent/10" },
      { label: "Total Asset Value", value: `₹${(stats?.totalAssetValue ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-warning", bg: "bg-warning/10" }
    ];
  }, [projects.length, stats]);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Administrative Dashboard</h1>
        <p className="page-subtitle">Project and asset overview for the PMO team</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className={`p-2.5 rounded-xl ${kpi.bg} w-fit mb-3`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-semibold mb-4">Asset Status Snapshot</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {(["IN_USE", "IN_STORE", "UNDER_REPAIR", "DISPOSED"] as const).map((status) => (
            <div key={status} className="rounded-2xl bg-secondary/40 border border-border/40 p-4">
              <p className="text-muted-foreground">{status.replace(/_/g, " ")}</p>
              <p className="text-2xl font-bold mt-1">{stats?.statusCounts?.[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
