import { PageWrapper } from "@/components/PageWrapper";
import { ListTodo, AlertTriangle, FileCheck, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportStatusConfig } from "@/lib/domain";

export default function AdminDashboard() {
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "admin-dashboard"], queryFn: () => api.getTasks({ limit: 200 }) });
  const { data: reportsData } = useQuery({ queryKey: ["reports", "admin-dashboard"], queryFn: () => api.getReports({ limit: 200 }) });

  const tasks = tasksData?.items ?? [];
  const reports = reportsData?.items ?? [];

  const kpis = [
    { label: "Open Tasks", value: tasks.filter((task) => task.status !== "DONE").length, icon: ListTodo, color: "text-primary", bg: "bg-primary/10" },
    { label: "Overdue", value: tasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "DONE").length, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
    { label: "Submitted Reports", value: reports.filter((report) => report.status === "SUBMITTED").length, icon: FileCheck, color: "text-accent", bg: "bg-accent/10" },
    { label: "Completed", value: tasks.filter((task) => task.status === "DONE").length, icon: CheckCircle2, color: "text-accent", bg: "bg-accent/10" }
  ];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your highway operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
        <h3 className="font-semibold mb-4">Recent Submissions</h3>
        <div className="space-y-3">
          {reports.slice(0, 6).map((report) => (
            <div key={report.id} className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{report.task?.title ?? report.id}</p>
                <p className="text-xs text-muted-foreground">{report.submittedBy?.name ?? "Employee"} · {new Date(report.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`status-badge ${reportStatusConfig[report.status].color}`}>{reportStatusConfig[report.status].label}</span>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}