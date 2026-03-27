import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Eye, CheckCircle, XCircle, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportItem } from "@/lib/domain";
import { reportStatusConfig, toAvatarUrl } from "@/lib/domain";

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

type EmployeeTaskDetail = {
  taskId: string;
  title: string;
  submittedByName: string;
  submittedByEmail: string;
  dateLabel: string;
  dateValue: string;
  daysLabel: string;
  daysValue: string;
  statusLabel: string;
  report: ReportItem | null;
};

export default function AdminReports() {
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [toDate, setToDate] = useState<string>(() => toInputDate(new Date()));
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

  const range = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    return { start, end };
  }, [fromDate, toDate]);

  const rangeLabel = useMemo(() => {
    return `${new Date(`${fromDate}T00:00:00`).toLocaleDateString()} - ${new Date(`${toDate}T00:00:00`).toLocaleDateString()}`;
  }, [fromDate, toDate]);

  const periodFilteredReports = useMemo(
    () => reports.filter((report) => {
      const createdAt = new Date(report.createdAt);
      return createdAt >= range.start && createdAt <= range.end;
    }),
    [reports, range]
  );

  const periodFilteredTasks = useMemo(
    () => tasks.filter((task) => {
      const allocatedAt = new Date(task.allocatedAt ?? task.createdAt);
      return allocatedAt >= range.start && allocatedAt <= range.end;
    }),
    [tasks, range]
  );

  const filteredReports = useMemo(() => {
    if (employeeId === "ALL") {
      return periodFilteredReports;
    }
    return periodFilteredReports.filter((report) => report.submittedById === employeeId);
  }, [periodFilteredReports, employeeId]);

  const employeeTaskDetails = useMemo<EmployeeTaskDetail[]>(() => {
    if (employeeId === "ALL") {
      return [];
    }

    const selectedEmployee = users.find((user) => user.id === employeeId);
    const employeeTasks = periodFilteredTasks
      .filter((task) => task.assignedToId === employeeId)
      .sort((left, right) => {
        const leftDate = new Date(left.allocatedAt ?? left.createdAt).getTime();
        const rightDate = new Date(right.allocatedAt ?? right.createdAt).getTime();
        return rightDate - leftDate;
      });

    return employeeTasks.map((task) => {
      const latestReport =
        periodFilteredReports
          .filter((report) => report.taskId === task.id)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
      const referenceDate = latestReport?.createdAt ?? task.submittedForReviewAt ?? task.allocatedAt ?? task.createdAt;
      const completionDays = task.completionDays ?? task.allottedDays ?? null;

      return {
        taskId: task.id,
        title: task.title,
        submittedByName: selectedEmployee?.name ?? task.assignedTo?.name ?? "Employee",
        submittedByEmail: selectedEmployee?.email ?? task.assignedTo?.email ?? "-",
        dateLabel: latestReport ? "Submitted" : "Allocated",
        dateValue: new Date(referenceDate).toLocaleDateString(),
        daysLabel: task.completionDays != null ? "Completion Days" : task.allottedDays != null ? "Allotted Days" : "Days",
        daysValue: completionDays != null ? String(completionDays) : "-",
        statusLabel: latestReport ? reportStatusConfig[latestReport.status].label : task.status.replace(/_/g, " "),
        report: latestReport
      };
    });
  }, [employeeId, users, periodFilteredTasks, periodFilteredReports]);

  useEffect(() => {
    if (employeeId === "ALL") {
      return;
    }

    if (selectedReport && employeeTaskDetails.some((detail) => detail.report?.id === selectedReport)) {
      return;
    }

    setSelectedReport(employeeTaskDetails[0]?.report?.id ?? null);
  }, [employeeId, employeeTaskDetails, selectedReport]);

  const selected = reports.find((report) => report.id === selectedReport);

  const { data: taskComments = [], refetch: refetchTaskComments } = useQuery({
    queryKey: ["task-comments", selected?.taskId],
    queryFn: () => api.getTaskComments(selected!.taskId),
    enabled: Boolean(selected?.taskId)
  });

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

  const previewEntries = useMemo(() => (selected ? Object.entries(selected.submission ?? {}) : []), [selected]);

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

  const shouldIncludeTaskDetailsInExport = employeeId !== "ALL";

  const downloadBreakdownCsv = () => {
    const headers = ["Employee", "Email", "From", "To", "Tasks Given", "Tasks Completed", "Admin Comments", "Average Rating"];
    const rows = employeeBreakdown.map((row) => [
      row.name,
      row.email,
      fromDate,
      toDate,
      String(row.tasksGiven),
      String(row.tasksCompleted),
      String(row.adminComments),
      row.avgRating === null ? "-" : String(row.avgRating)
    ]);

    const escape = (value: string) => `"${value.replace(/\"/g, '""')}"`;
    const summaryCsv = [headers, ...rows].map((line) => line.map(escape).join(",")).join("\n");
    const taskDetailsCsv = shouldIncludeTaskDetailsInExport
      ? [
          "",
          ["Task Details"],
          ["Task", "Submitted By", "Email", "Date Type", "Date", "Days Type", "Days", "Status"],
          ...employeeTaskDetails.map((detail) => [
            detail.title,
            detail.submittedByName,
            detail.submittedByEmail,
            detail.dateLabel,
            detail.dateValue,
            detail.daysLabel,
            detail.daysValue,
            detail.statusLabel
          ])
        ]
          .map((line) => line.map(escape).join(","))
          .join("\n")
      : "";
    const csv = [summaryCsv, taskDetailsCsv].filter(Boolean).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employee-breakdown-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadBreakdownExcel = () => {
    const rows = employeeBreakdown.map((row) => ({
      Employee: row.name,
      Email: row.email,
      From: fromDate,
      To: toDate,
      "Tasks Given": row.tasksGiven,
      "Tasks Completed": row.tasksCompleted,
      "Admin Comments": row.adminComments,
      "Average Rating": row.avgRating ?? "-"
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdown");

    if (shouldIncludeTaskDetailsInExport) {
      const detailRows = employeeTaskDetails.map((detail) => ({
        Task: detail.title,
        "Submitted By": detail.submittedByName,
        Email: detail.submittedByEmail,
        "Date Type": detail.dateLabel,
        Date: detail.dateValue,
        "Days Type": detail.daysLabel,
        Days: detail.daysValue,
        Status: detail.statusLabel
      }));
      const detailWorksheet = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(workbook, detailWorksheet, "Task Details");
    }

    XLSX.writeFile(workbook, `employee-breakdown-${fromDate}-to-${toDate}.xlsx`);
  };

  const downloadBreakdownPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Per-Employee Breakdown (${rangeLabel})`, 14, 14);

    autoTable(doc, {
      head: [["Employee", "Email", "From", "To", "Tasks Given", "Tasks Completed", "Admin Comments", "Average Rating"]],
      body: employeeBreakdown.map((row) => [
        row.name,
        row.email,
        fromDate,
        toDate,
        String(row.tasksGiven),
        String(row.tasksCompleted),
        String(row.adminComments),
        row.avgRating === null ? "-" : String(row.avgRating)
      ]),
      startY: 20,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] }
    });

    if (shouldIncludeTaskDetailsInExport) {
      autoTable(doc, {
        head: [["Task", "Submitted By", "Email", "Date Type", "Date", "Days Type", "Days", "Status"]],
        body: employeeTaskDetails.map((detail) => [
          detail.title,
          detail.submittedByName,
          detail.submittedByEmail,
          detail.dateLabel,
          detail.dateValue,
          detail.daysLabel,
          detail.daysValue,
          detail.statusLabel
        ]),
        startY: ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 20) + 10,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: 14, right: 14 }
      });
    }

    doc.save(`employee-breakdown-${fromDate}-to-${toDate}.pdf`);
  };

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Review and approve submitted reports</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              const nextFrom = event.target.value;
              setFromDate(nextFrom);
              if (toDate < nextFrom) {
                setToDate(nextFrom);
              }
            }}
            title="From date"
            aria-label="From date"
            className="report-date-input h-12 w-full rounded-xl border border-border/50 bg-secondary/50 px-3 text-sm"
            required
          />
        </div>

        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(event) => {
              const nextTo = event.target.value;
              if (nextTo < fromDate) {
                toast.error("To date must be after or equal to From date");
                return;
              }
              setToDate(nextTo);
            }}
            title="To date"
            aria-label="To date"
            className="report-date-input h-12 w-full rounded-xl border border-border/50 bg-secondary/50 px-3 text-sm"
            required
          />
        </div>

        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs text-muted-foreground">Employee</label>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            title="Select employee"
            aria-label="Select employee"
            className="h-12 w-full rounded-xl border border-border/50 bg-secondary/50 px-3 text-sm"
          >
            <option value="ALL">All Employees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Tasks Given</p><p className="text-xl font-semibold">{summary.taskGiven}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Tasks Completed</p><p className="text-xl font-semibold">{summary.taskCompleted}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Admin Comments</p><p className="text-xl font-semibold">{summary.adminComments}</p></div>
        <div className="glass-panel p-4"><p className="text-xs text-muted-foreground">Average Rating</p><p className="text-xl font-semibold">{summary.avgRating}</p></div>
      </div>

      <div className="glass-panel mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 p-4">
          <h3 className="text-sm font-semibold">Per-Employee Breakdown ({rangeLabel})</h3>
          <div className="flex items-center gap-2">
            <button onClick={downloadBreakdownCsv} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">CSV</button>
            <button onClick={downloadBreakdownExcel} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">Excel</button>
            <button onClick={downloadBreakdownPdf} className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">PDF</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="p-3 text-left font-medium">Employee</th>
                <th className="p-3 text-left font-medium">Tasks Given</th>
                <th className="p-3 text-left font-medium">Tasks Completed</th>
                <th className="p-3 text-left font-medium">Admin Comments</th>
                <th className="p-3 text-left font-medium">Average Rating</th>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="glass-panel overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="p-4 text-left font-medium">Task</th>
                <th className="hidden p-4 text-left font-medium sm:table-cell">Submitted By</th>
                <th className="hidden p-4 text-left font-medium md:table-cell">Date</th>
                <th className="hidden p-4 text-left font-medium xl:table-cell">Days</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeeId === "ALL" ? filteredReports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={cn(
                    "cursor-pointer border-b border-border/30 transition-colors hover:bg-secondary/30",
                    selectedReport === report.id && "bg-secondary/30"
                  )}
                >
                  <td className="p-4">
                    <p className="font-medium">{report.task?.title ?? report.id}</p>
                    <p className="text-xs text-muted-foreground">{report.reportTemplate?.name ?? "Template"}</p>
                  </td>
                  <td className="hidden p-4 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <img src={toAvatarUrl(report.submittedBy?.name ?? "User")} alt="" className="h-6 w-6 rounded-full" />
                      <span className="text-muted-foreground">{report.submittedBy?.name ?? "-"}</span>
                    </div>
                  </td>
                  <td className="hidden p-4 text-muted-foreground md:table-cell">{new Date(report.createdAt).toLocaleDateString()}</td>
                  <td className="hidden p-4 text-muted-foreground xl:table-cell">{report.turnaroundDays ?? "-"}</td>
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
                        className="rounded-lg p-1.5 text-accent transition-colors hover:bg-accent/10"
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
                        className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
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
                        className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : employeeTaskDetails.map((detail) => (
                <tr
                  key={detail.taskId}
                  onClick={() => detail.report && setSelectedReport(detail.report.id)}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    detail.report ? "cursor-pointer hover:bg-secondary/30" : "cursor-default",
                    detail.report?.id === selectedReport && "bg-secondary/30"
                  )}
                >
                  <td className="p-4">
                    <p className="font-medium">{detail.title}</p>
                    <p className="text-xs text-muted-foreground">{detail.report?.reportTemplate?.name ?? "Task detail"}</p>
                  </td>
                  <td className="hidden p-4 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <img src={toAvatarUrl(detail.submittedByName)} alt="" className="h-6 w-6 rounded-full" />
                      <span className="text-muted-foreground">{detail.submittedByName}</span>
                    </div>
                  </td>
                  <td className="hidden p-4 text-muted-foreground md:table-cell">{detail.dateLabel}: {detail.dateValue}</td>
                  <td className="hidden p-4 text-muted-foreground xl:table-cell">{detail.daysValue === "-" ? "-" : `${detail.daysLabel}: ${detail.daysValue}`}</td>
                  <td className="p-4">
                    {detail.report ? (
                      <span className={cn("status-badge", reportStatusConfig[detail.report.status].color)}>
                        {detail.statusLabel}
                      </span>
                    ) : (
                      <span className="status-badge bg-muted text-muted-foreground">{detail.statusLabel}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {detail.report ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleStatusUpdate(detail.report!.id, "APPROVED");
                          }}
                          title="Approve report"
                          aria-label="Approve report"
                          className="rounded-lg p-1.5 text-accent transition-colors hover:bg-accent/10"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setFeedbackModal(detail.report!.id);
                          }}
                          title="Request changes"
                          aria-label="Request changes"
                          className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleStatusUpdate(detail.report!.id, "REJECTED");
                          }}
                          title="Reject report"
                          aria-label="Reject report"
                          className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No report</span>
                    )}
                  </td>
                </tr>
              ))}
              {employeeId === "ALL" && filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-sm text-muted-foreground">No reports found for selected filters.</td>
                </tr>
              )}
              {employeeId !== "ALL" && employeeTaskDetails.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-sm text-muted-foreground">No task details found for the selected employee and date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="glass-panel p-6">
          {selected ? (
            <div>
              <h3 className="mb-4 font-semibold">Report Preview</h3>
              <div className="space-y-3">
                {previewEntries.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-sm font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>
              {selected.adminFeedback && (
                <div className="mt-4 rounded-xl border border-warning/20 bg-warning/5 p-3">
                  <p className="mb-1 text-xs text-warning">Feedback</p>
                  <p className="text-sm">{selected.adminFeedback}</p>
                </div>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs text-muted-foreground">Task Comments</p>
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {taskComments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-border/40 p-2">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {comment.author?.name ?? "User"} | {new Date(comment.createdAt).toLocaleString()}
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
                  className="mt-2 w-full resize-none rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 text-foreground outline-none focus:border-primary/50"
                  placeholder="Comment for employee"
                />
                <button
                  onClick={() => void handleAddTaskComment()}
                  className="mt-2 w-full rounded-xl border border-primary/20 bg-primary/10 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Send Comment
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Eye className="mb-2 h-8 w-8 opacity-50" />
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
            className="glass-panel-strong mx-4 w-full max-w-md p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Request Changes</h3>
              <button aria-label="Close" title="Close" onClick={() => setFeedbackModal(null)} className="rounded-lg p-1 hover:bg-secondary/50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              className="mb-4 w-full resize-none rounded-xl border border-border/50 bg-secondary/50 px-4 py-2.5 text-foreground outline-none focus:border-primary/50"
              placeholder="Describe what changes are needed..."
            />
            <button
              onClick={() => void handleRequestChanges()}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-accent py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Send Feedback
            </button>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
