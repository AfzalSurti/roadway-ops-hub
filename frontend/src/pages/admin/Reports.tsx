import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Eye, CheckCircle, XCircle, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ReportItem, ReportStatus } from "@/lib/domain";
import { reportStatusConfig, toAvatarUrl } from "@/lib/domain";

type ReportStatusFilter = "ALL" | ReportStatus;

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

export default function AdminReports() {
  const [filter, setFilter] = useState<ReportStatusFilter>("ALL");
  const [period, setPeriod] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [employeeId, setEmployeeId] = useState<string>("ALL");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [taskComment, setTaskComment] = useState("");

  const { data } = useQuery({ queryKey: ["reports", "admin"], queryFn: () => api.getReports({ limit: 100 }) });
  const { data: users = [] } = useQuery({ queryKey: ["users", "report-summary"], queryFn: () => api.getUsers() });
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "report-summary"], queryFn: () => api.getTasks({ limit: 400 }) });

  const reports = data?.items ?? [];
  const tasks = tasksData?.items ?? [];

  const periodRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();

    if (period === "MONTHLY") {
      const start = new Date(year, selectedMonth, 1);
      const end = new Date(year, selectedMonth + 1, 1);
      return { start, end };
    }

    if (period === "QUARTERLY") {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 1);
      return { start, end };
    }

    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1)
    };
  }, [period, selectedMonth]);

  const periodLabel = useMemo(() => {
    if (period === "MONTHLY") {
      return `${MONTH_OPTIONS[selectedMonth]} ${new Date().getFullYear()}`;
    }
    if (period === "QUARTERLY") {
      const quarter = Math.floor(new Date().getMonth() / 3) + 1;
      return `Q${quarter} ${new Date().getFullYear()}`;
    }
    return String(new Date().getFullYear());
  }, [period, selectedMonth]);

  const periodFilteredReports = useMemo(
    () => reports.filter((report) => {
      const createdAt = new Date(report.createdAt);
      return createdAt >= periodRange.start && createdAt < periodRange.end;
    }),
    [reports, periodRange]
  );
  const periodFilteredTasks = useMemo(
    () => tasks.filter((task) => {
      const allocatedAt = new Date(task.allocatedAt ?? task.createdAt);
      return allocatedAt >= periodRange.start && allocatedAt < periodRange.end;
    }),
    [tasks, periodRange]
  );

  const filtered = useMemo(() => {
    const byStatus = filter === "ALL" ? periodFilteredReports : periodFilteredReports.filter((report) => report.status === filter);
    if (employeeId === "ALL") return byStatus;
    return byStatus.filter((report) => report.submittedById === employeeId);
  }, [filter, periodFilteredReports, employeeId]);
  const selected = reports.find((report) => report.id === selectedReport);
  const { data: taskComments = [], refetch: refetchTaskComments } = useQuery({
    queryKey: ["task-comments", selected?.taskId],
    queryFn: () => api.getTaskComments(selected!.taskId),
    enabled: Boolean(selected?.taskId)
  });

  const statusFilters: { value: ReportStatusFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "APPROVED", label: "Approved" },
    { value: "CHANGES_REQUESTED", label: "Changes Requested" },
    { value: "REJECTED", label: "Rejected" }
  ];

  const handleStatusUpdate = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await api.updateReportStatus(id, status);
      toast.success(`Report ${status.toLowerCase()}`);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update report";
      toast.error(message);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedbackModal || !feedback.trim()) {
      return;
    }

    try {
      await api.updateReportStatus(feedbackModal, "CHANGES_REQUESTED");
      await api.updateReportFeedback(feedbackModal, feedback);
      toast.success("Changes requested");
      setFeedbackModal(null);
      setFeedback("");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit feedback";
      toast.error(message);
    }
  };

  const handleAddTaskComment = async () => {
    if (!selected?.taskId || !taskComment.trim()) {
      return;
    }

    try {
      await api.addTaskComment(selected.taskId, taskComment.trim());
      setTaskComment("");
      await refetchTaskComments();
      toast.success("Comment sent to employee");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add comment";
      toast.error(message);
    }
  };

  const previewEntries = useMemo(
    () => (selected ? Object.entries(selected.submission ?? {}) : []),
    [selected]
  );

  const summary = useMemo(() => {
    const scopedTasks = employeeId === "ALL" ? periodFilteredTasks : periodFilteredTasks.filter((task) => task.assignedToId === employeeId);
    const scopedReports = employeeId === "ALL" ? periodFilteredReports : periodFilteredReports.filter((report) => report.submittedById === employeeId);
    const taskCompleted = scopedTasks.filter((task) => task.status === "DONE").length;
    const adminComments = scopedReports.filter((report) => Boolean(report.adminFeedback?.trim())).length;
    const rated = scopedTasks.filter((task) => typeof task.rating === "number");
    const avgRating = rated.length ? (rated.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / rated.length).toFixed(2) : "-";

    return {
      taskGiven: scopedTasks.length,
      taskCompleted,
      adminComments,
      avgRating
    };
  }, [periodFilteredTasks, periodFilteredReports, employeeId]);

  const employeeBreakdown = useMemo(() => {
    const scopedUsers = employeeId === "ALL" ? users : users.filter((user) => user.id === employeeId);

    return scopedUsers.map((user) => {
      const employeeTasks = periodFilteredTasks.filter((task) => task.assignedToId === user.id);
      const employeeReports = periodFilteredReports.filter((report) => report.submittedById === user.id);
      const tasksCompleted = employeeTasks.filter((task) => task.status === "DONE").length;
      const adminComments = employeeReports.filter((report) => Boolean(report.adminFeedback?.trim())).length;
      const ratedTasks = employeeTasks.filter((task) => typeof task.rating === "number");
      const avgRating = ratedTasks.length
        ? Number((ratedTasks.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / ratedTasks.length).toFixed(2))
        : null;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        tasksGiven: employeeTasks.length,
        tasksCompleted,
        adminComments,
        avgRating
      };
    });
  }, [users, periodFilteredTasks, periodFilteredReports, employeeId]);

  const downloadBreakdownCsv = () => {
    const headers = ["Employee", "Email", "Period", "Tasks Given", "Tasks Completed", "Admin Comments", "Average Rating"];
    const rows = employeeBreakdown.map((row) => [
      row.name,
      row.email,
      period,
      periodLabel,
      String(row.tasksGiven),
      String(row.tasksCompleted),
      String(row.adminComments),
      row.avgRating === null ? "-" : String(row.avgRating)
    ]);

    const escape = (value: string) => `"${value.replace(/\"/g, '""')}"`;
    const csv = [headers, ...rows].map((line) => line.map(escape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filePeriod = period === "MONTHLY" ? MONTH_OPTIONS[selectedMonth].toLowerCase() : period.toLowerCase();
    link.download = `employee-breakdown-${filePeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Review and approve submitted reports</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as "MONTHLY" | "QUARTERLY" | "YEARLY")}
          title="Select period"
          aria-label="Select period"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
        >
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="YEARLY">Yearly</option>
        </select>
        {period === "MONTHLY" && (
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            title="Select month"
            aria-label="Select month"
            className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          >
            {MONTH_OPTIONS.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
        )}
        <select
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          title="Select employee"
          aria-label="Select employee"
          className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm"
        >
          <option value="ALL">All Employees</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
        {statusFilters.map((statusFilter) => (
          <button
            key={statusFilter.value}
            onClick={() => setFilter(statusFilter.value)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              filter === statusFilter.value
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-secondary/50 text-muted-foreground border border-border/50 hover:text-foreground"
            )}
          >
            {statusFilter.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Tasks Given</p><p className="text-xl font-semibold">{summary.taskGiven}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Tasks Completed</p><p className="text-xl font-semibold">{summary.taskCompleted}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Admin Comments</p><p className="text-xl font-semibold">{summary.adminComments}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Average Rating</p><p className="text-xl font-semibold">{summary.avgRating}</p></div>
      </div>

      <div className="glass-panel overflow-hidden mb-6">
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <h3 className="text-sm font-semibold">Per-Employee Breakdown ({periodLabel})</h3>
          <button
            onClick={downloadBreakdownCsv}
            className="px-3 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20"
          >
            Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="text-left p-3 font-medium">Employee</th>
                <th className="text-left p-3 font-medium">Tasks Given</th>
                <th className="text-left p-3 font-medium">Tasks Completed</th>
                <th className="text-left p-3 font-medium">Admin Comments</th>
                <th className="text-left p-3 font-medium">Average Rating</th>
              </tr>
            </thead>
            <tbody>
              {employeeBreakdown.map((row) => (
                <tr key={row.userId} className="border-b border-border/20">
                  <td className="p-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </td>
                  <td className="p-3">{row.tasksGiven}</td>
                  <td className="p-3">{row.tasksCompleted}</td>
                  <td className="p-3">{row.adminComments}</td>
                  <td className="p-3">{row.avgRating ?? "-"}</td>
                </tr>
              ))}
              {employeeBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sm text-muted-foreground">No employee data available for selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Task</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Submitted By</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Date</th>
                <th className="text-left p-4 font-medium hidden xl:table-cell">Days</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={cn(
                    "border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer",
                    selectedReport === report.id && "bg-secondary/30"
                  )}
                >
                  <td className="p-4">
                    <p className="font-medium">{report.task?.title ?? report.id}</p>
                    <p className="text-xs text-muted-foreground">{report.reportTemplate?.name ?? "Template"}</p>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <img src={toAvatarUrl(report.submittedBy?.name ?? "User")} alt="" className="w-6 h-6 rounded-full" />
                      <span className="text-muted-foreground">{report.submittedBy?.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 hidden xl:table-cell text-muted-foreground">{report.turnaroundDays ?? "-"}</td>
                  <td className="p-4">
                    <span className={cn("status-badge", reportStatusConfig[report.status].color)}>
                      {reportStatusConfig[report.status].label}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleStatusUpdate(report.id, "APPROVED");
                        }}
                        title="Approve report"
                        aria-label="Approve report"
                        className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setFeedbackModal(report.id);
                        }}
                        title="Request changes"
                        aria-label="Request changes"
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleStatusUpdate(report.id, "REJECTED");
                        }}
                        title="Reject report"
                        aria-label="Reject report"
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-panel p-6">
          {selected ? (
            <div>
              <h3 className="font-semibold mb-4">Report Preview</h3>
              <div className="space-y-3">
                {previewEntries.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-sm font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
              {selected.adminFeedback && (
                <div className="mt-4 p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-warning mb-1">Feedback</p>
                  <p className="text-sm">{selected.adminFeedback}</p>
                </div>
              )}

              <div className="mt-5">
                <p className="text-xs text-muted-foreground mb-2">Task Comments</p>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {taskComments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-border/40 p-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        {comment.author?.name ?? "User"} • {new Date(comment.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm">{comment.body}</p>
                    </div>
                  ))}
                  {taskComments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
                </div>
                <textarea
                  value={taskComment}
                  onChange={(event) => setTaskComment(event.target.value)}
                  rows={2}
                  className="mt-2 w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                  placeholder="Comment for employee"
                />
                <button
                  onClick={() => void handleAddTaskComment()}
                  className="mt-2 w-full py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  Send Comment
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Eye className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Select a report to preview</p>
            </div>
          )}
        </div>
      </div>

      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel-strong p-6 w-full max-w-md mx-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Request Changes</h3>
              <button aria-label="Close" title="Close" onClick={() => setFeedbackModal(null)} className="p-1 rounded-lg hover:bg-secondary/50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none mb-4 focus:border-primary/50"
              placeholder="Describe what changes are needed…"
            />
            <button
              onClick={() => void handleRequestChanges()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Send Feedback
            </button>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}