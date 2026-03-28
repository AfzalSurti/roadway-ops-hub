import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ApiUser, ReportItem, TaskItem } from "./domain";

type ExportFormat = "pdf" | "excel" | "csv";

type ExportArgs = {
  employeeId: string;
  fromDate: string;
  toDate: string;
  format?: ExportFormat;
  users: ApiUser[];
  tasks: TaskItem[];
  reports: ReportItem[];
};

type EmployeeTaskDetail = {
  title: string;
  submittedByName: string;
  submittedByEmail: string;
  dateLabel: string;
  dateValue: string;
  daysLabel: string;
  daysValue: string;
  statusLabel: string;
};

function buildExportData(args: ExportArgs) {
  const { employeeId, fromDate, toDate, users, tasks, reports } = args;
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59`);
  const employee = users.find((user) => user.id === employeeId);

  const periodFilteredReports = reports.filter((report) => {
    const createdAt = new Date(report.createdAt);
    return createdAt >= start && createdAt <= end;
  });

  const periodFilteredTasks = tasks.filter((task) => {
    const allocatedAt = new Date(task.allocatedAt ?? task.createdAt);
    return allocatedAt >= start && allocatedAt <= end;
  });

  const employeeTasks = periodFilteredTasks.filter((task) => task.assignedToId === employeeId);
  const employeeReports = periodFilteredReports.filter((report) => report.submittedById === employeeId);
  const completed = employeeTasks.filter((task) => task.status === "DONE").length;
  const pending = employeeTasks.filter((task) => task.status === "TODO").length;
  const underReview = employeeTasks.filter((task) => task.status === "IN_PROGRESS").length;
  const blocked = employeeTasks.filter((task) => task.status === "BLOCKED").length;
  const adminComments = employeeReports.filter((report) => Boolean(report.adminFeedback?.trim())).length;
  const ratedTasks = employeeTasks.filter((task) => typeof task.rating === "number");
  const averageRating = ratedTasks.length
    ? Number((ratedTasks.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / ratedTasks.length).toFixed(2))
    : "-";

  const taskDetails: EmployeeTaskDetail[] = employeeTasks.map((task) => {
    const latestReport =
      employeeReports
        .filter((report) => report.taskId === task.id)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
    const referenceDate = latestReport?.createdAt ?? task.submittedForReviewAt ?? task.allocatedAt ?? task.createdAt;
    const completionDays = task.completionDays ?? task.allottedDays ?? null;

    return {
      title: task.title,
      submittedByName: employee?.name ?? task.assignedTo?.name ?? "Employee",
      submittedByEmail: employee?.email ?? task.assignedTo?.email ?? "-",
      dateLabel: latestReport ? "Submitted" : "Allocated",
      dateValue: new Date(referenceDate).toLocaleDateString(),
      daysLabel: task.completionDays != null ? "Completion Days" : task.allottedDays != null ? "Allotted Days" : "Days",
      daysValue: completionDays != null ? String(completionDays) : "-",
      statusLabel: latestReport?.status ?? task.status
    };
  });

  return {
    employeeName: employee?.name ?? "Employee",
    summaryRow: {
      Employee: employee?.name ?? "Employee",
      Email: employee?.email ?? "-",
      From: fromDate,
      To: toDate,
      "Tasks Given": employeeTasks.length,
      Completed: completed,
      Pending: pending,
      "Under Review": underReview,
      Blocked: blocked,
      "Admin Comments": adminComments,
      "Average Rating": averageRating
    },
    taskDetails
  };
}

export function downloadEmployeeAssistantReport(args: ExportArgs) {
  const format = args.format ?? "pdf";
  const data = buildExportData(args);
  const safeName = data.employeeName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 30) || "employee";
  const fileBase = `employee-report-${safeName}-${args.fromDate}-to-${args.toDate}`;

  if (format === "csv") {
    const escape = (value: string) => `"${value.replace(/\"/g, '""')}"`;
    const summaryHeaders = Object.keys(data.summaryRow);
    const summaryValues = Object.values(data.summaryRow).map((value) => String(value));
    const taskHeaders = ["Task", "Submitted By", "Email", "Date Type", "Date", "Days Type", "Days", "Status"];
    const taskRows = data.taskDetails.map((detail) => [
      detail.title,
      detail.submittedByName,
      detail.submittedByEmail,
      detail.dateLabel,
      detail.dateValue,
      detail.daysLabel,
      detail.daysValue,
      detail.statusLabel
    ]);
    const csv = [
      [summaryHeaders, summaryValues].map((line) => line.map(escape).join(",")).join("\n"),
      "",
      [taskHeaders, ...taskRows].map((line) => line.map(escape).join(",")).join("\n")
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  if (format === "excel") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([data.summaryRow]), "Summary");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        data.taskDetails.map((detail) => ({
          Task: detail.title,
          "Submitted By": detail.submittedByName,
          Email: detail.submittedByEmail,
          "Date Type": detail.dateLabel,
          Date: detail.dateValue,
          "Days Type": detail.daysLabel,
          Days: detail.daysValue,
          Status: detail.statusLabel
        }))
      ),
      "Task Details"
    );
    XLSX.writeFile(workbook, `${fileBase}.xlsx`);
    return;
  }

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Employee Report: ${data.employeeName}`, 14, 14);
  autoTable(doc, {
    body: [Object.values(data.summaryRow).map((value) => String(value))],
    head: [Object.keys(data.summaryRow)],
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] }
  });
  autoTable(doc, {
    body: data.taskDetails.map((detail) => [
      detail.title,
      detail.submittedByName,
      detail.submittedByEmail,
      detail.dateLabel,
      detail.dateValue,
      detail.daysLabel,
      detail.daysValue,
      detail.statusLabel
    ]),
    head: [["Task", "Submitted By", "Email", "Date Type", "Date", "Days Type", "Days", "Status"]],
    startY: ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 20) + 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] }
  });
  doc.save(`${fileBase}.pdf`);
}
