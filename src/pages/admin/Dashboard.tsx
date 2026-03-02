import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import {
  ListTodo,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import {
  tasks,
  reports,
  users,
  tasksByStatusData,
  completionTrendData,
  reportTypeLabels,
  statusConfig,
  priorityConfig,
} from "@/lib/mock-data";

const kpis = [
  {
    label: "Open Tasks",
    value: tasks.filter((t) => t.status !== "done").length,
    icon: ListTodo,
    trend: "+3",
    trendUp: false,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    label: "Overdue",
    value: tasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== "done").length,
    icon: AlertTriangle,
    trend: "-1",
    trendUp: true,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    label: "Pending Approvals",
    value: reports.filter((r) => r.status === "pending").length,
    icon: FileCheck,
    trend: "+2",
    trendUp: false,
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    label: "Completed This Week",
    value: tasks.filter((t) => t.status === "done").length,
    icon: CheckCircle2,
    trend: "+5",
    trendUp: true,
    color: "text-accent",
    bg: "bg-accent/10",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AdminDashboard() {
  const recentReports = reports.slice(0, 4);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your highway operations</p>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={item} className="kpi-card">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${kpi.bg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <span
                className={`text-xs font-medium flex items-center gap-1 ${
                  kpi.trendUp ? "text-accent" : "text-warning"
                }`}
              >
                <TrendingUp className={`h-3 w-3 ${!kpi.trendUp ? "rotate-180" : ""}`} />
                {kpi.trend}
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div variants={item} initial="hidden" animate="show" className="glass-panel p-6">
          <h3 className="font-semibold mb-4">Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tasksByStatusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
              <XAxis dataKey="status" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 16%, 10%)",
                  border: "1px solid hsl(220, 14%, 16%)",
                  borderRadius: "12px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {tasksByStatusData.map((entry, i) => (
                  <motion.rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="glass-panel p-6">
          <h3 className="font-semibold mb-4">Completion Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={completionTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
              <XAxis dataKey="week" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 16%, 10%)",
                  border: "1px solid hsl(220, 14%, 16%)",
                  borderRadius: "12px",
                  color: "hsl(210, 20%, 92%)",
                }}
              />
              <Area type="monotone" dataKey="assigned" stroke="hsl(215, 15%, 55%)" fill="hsl(215, 15%, 55%, 0.1)" strokeWidth={2} />
              <Area type="monotone" dataKey="completed" stroke="hsl(185, 70%, 50%)" fill="hsl(185, 70%, 50%, 0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Submissions */}
      <motion.div variants={item} initial="hidden" animate="show" className="glass-panel p-6">
        <h3 className="font-semibold mb-4">Recent Submissions</h3>
        <div className="space-y-3">
          {recentReports.map((report) => {
            const task = tasks.find((t) => t.id === report.taskId);
            const submitter = users.find((u) => u.id === report.submittedBy);
            return (
              <div
                key={report.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <img src={submitter?.avatar} alt="" className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task?.title}</p>
                  <p className="text-xs text-muted-foreground">{submitter?.name} · {new Date(report.submittedAt).toLocaleDateString()}</p>
                </div>
                <span
                  className={`status-badge ${
                    report.status === "pending"
                      ? "text-warning bg-warning/10"
                      : report.status === "approved"
                      ? "text-accent bg-accent/10"
                      : "text-destructive bg-destructive/10"
                  }`}
                >
                  {report.status.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </PageWrapper>
  );
}
