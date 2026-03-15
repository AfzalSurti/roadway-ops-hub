import jsPDF from "jspdf";
import type { TaskItem } from "./domain";

// ─── helpers ────────────────────────────────────────────────────────────────

const BLUE = [30, 64, 175] as const;      // indigo-700
const DARK = [17, 24, 39] as const;       // gray-900
const MID  = [107, 114, 128] as const;    // gray-500
const LIGHT = [243, 244, 246] as const;   // gray-100
const WHITE = [255, 255, 255] as const;

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(task: TaskItem): string {
  if (task.status === "DONE") return "Done";
  if (task.status === "IN_PROGRESS") return "Under Review";
  if (task.status === "TODO" && task.managerReviewComments) return "In Progress";
  return "To Do";
}

function priorityLabel(p: string) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setTextColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}
function setDrawColor(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

// page dims (A4 portrait)
const PW = 210;
const PH = 297;
const ML = 14;
const MR = 14;
const CW = PW - ML - MR;  // content width = 182

// ─── shared components ───────────────────────────────────────────────────────

function drawPageHeader(doc: jsPDF, title: string, subtitle: string) {
  // Blue banner
  setFill(doc, BLUE);
  doc.rect(0, 0, PW, 22, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, ML, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(subtitle, ML, 16);
  // Reset
  setTextColor(doc, DARK);
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  setFill(doc, BLUE);
  doc.rect(ML, y, CW, 6.5, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(text, ML + 2, y + 4.5);
  setTextColor(doc, DARK);
  return y + 6.5;
}

function kpiBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string | number, accent: readonly [number, number, number]) {
  setFill(doc, LIGHT);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
  setFill(doc, accent);
  doc.rect(x, y, 2, h, "F");  // left accent bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setTextColor(doc, accent);
  doc.text(String(value), x + 5, y + h / 2 + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, MID);
  doc.text(label, x + 5, y + h / 2 + 6.5);
  setTextColor(doc, DARK);
}

function footerLine(doc: jsPDF, pageNo: number, total: number) {
  setDrawColor(doc, LIGHT);
  doc.setLineWidth(0.2);
  doc.line(ML, PH - 8, PW - MR, PH - 8);
  doc.setFontSize(7);
  setTextColor(doc, MID);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, ML, PH - 4);
  doc.text(`Page ${pageNo} of ${total}`, PW - MR, PH - 4, { align: "right" });
  setTextColor(doc, DARK);
}

// ─── SINGLE TASK REPORT ──────────────────────────────────────────────────────

export function downloadTaskReport(task: TaskItem) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const now = new Date().toLocaleString("en-IN");
  drawPageHeader(doc, "Task Report", `Generated on ${now}`);

  let y = 28;

  // ── Overview ─────────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "TASK OVERVIEW", y) + 3;

  const fields: Array<[string, string]> = [
    ["Task Title",       task.title],
    ["Project",          task.project || "-"],
    ["Status",           statusLabel(task)],
    ["Priority",         priorityLabel(task.priority)],
    ["Assigned To",      task.assignedTo?.name ?? "-"],
    ["Assigned By",      task.createdBy?.name ?? "-"],
    ["Allocated Date",   fmtDate(task.allocatedAt ?? task.createdAt)],
    ["Due Date",         fmtDate(task.dueDate)],
    ["Allotted Days",    task.allottedDays != null ? String(task.allottedDays) : "-"],
    ["Submitted At",     fmtDate(task.submittedForReviewAt)],
    ["Completed At",     fmtDate(task.actualCompletedAt)],
    ["Completion Days",  task.completionDays != null ? String(task.completionDays) : "-"],
    ["Delay (days)",     task.completionDelayDays != null ? String(task.completionDelayDays) : "-"],
    ["Rating",           task.ratingEnabled && task.status === "DONE" ? String(task.rating ?? "-") : "N/A"],
  ];

  const rowH = 7;
  const labelW = 50;

  setDrawColor(doc, [229, 231, 235]);
  doc.setLineWidth(0.15);

  for (let i = 0; i < fields.length; i++) {
    const [label, value] = fields[i];
    if (i % 2 === 0) {
      setFill(doc, LIGHT);
      doc.rect(ML, y, CW, rowH, "F");
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    setTextColor(doc, MID);
    doc.text(label, ML + 2, y + 4.8);

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    setTextColor(doc, DARK);
    const valLines = doc.splitTextToSize(value, CW - labelW - 4) as string[];
    doc.text(valLines[0] ?? "", ML + labelW, y + 4.8);

    doc.rect(ML, y, CW, rowH);
    doc.line(ML + labelW, y, ML + labelW, y + rowH);
    y += rowH;
  }

  y += 5;

  // ── Description ──────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "DESCRIPTION", y) + 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, DARK);
  const descLines = doc.splitTextToSize(task.description || "-", CW - 4) as string[];
  doc.text(descLines, ML + 2, y + 3);
  y += Math.max(10, descLines.length * 4) + 6;

  // ── Manager Review Comments ───────────────────────────────────────────────
  if (task.managerReviewComments) {
    y = drawSectionTitle(doc, "MANAGER REVIEW COMMENTS", y) + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const cmtLines = doc.splitTextToSize(task.managerReviewComments, CW - 4) as string[];
    doc.text(cmtLines, ML + 2, y + 3);
    y += Math.max(10, cmtLines.length * 4);
  }

  footerLine(doc, 1, 1);

  const safeName = task.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 40);
  doc.save(`Task_Report_${safeName}.pdf`);
}

// ─── PROJECT / DATE-RANGE REPORT ─────────────────────────────────────────────

export interface ProjectReportOptions {
  tasks: TaskItem[];
  projectName?: string;   // "All Projects" if not set
  fromDate?: string;
  toDate?: string;
}

export function downloadProjectReport({ tasks, projectName, fromDate, toDate }: ProjectReportOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  const PL  = 297; // landscape width
  const PHL = 210; // landscape height
  const CLW = PL - ML - MR;  // ~269

  const now = new Date().toLocaleString("en-IN");
  const title = projectName && projectName !== "ALL" ? `Project Report: ${projectName}` : "All Projects Task Report";
  const dateRange = fromDate && toDate
    ? `${fmtDate(fromDate + "T00:00:00")}  →  ${fmtDate(toDate + "T00:00:00")}`
    : "All Dates";

  // ── Cover / summary page ─────────────────────────────────────────────────
  // Banner
  setFill(doc, BLUE);
  doc.rect(0, 0, PL, 22, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(title, ML, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`Date Range: ${dateRange}  |  Generated: ${now}`, ML, 17);
  setTextColor(doc, DARK);

  // ── KPI boxes ────────────────────────────────────────────────────────────
  const total     = tasks.length;
  const done      = tasks.filter((t) => t.status === "DONE").length;
  const underReview = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const inProgress = tasks.filter((t) => t.status === "TODO" && !!t.managerReviewComments).length;
  const pending   = tasks.filter((t) => t.status === "TODO" && !t.managerReviewComments).length;
  const overdue   = tasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== "DONE").length;

  const kpis = [
    { label: "Total Tasks",      value: total,       color: BLUE },
    { label: "Pending (To Do)",  value: pending,     color: [107, 114, 128] as const },
    { label: "Under Review",     value: underReview, color: [161, 98, 7] as const },
    { label: "In Progress",      value: inProgress,  color: [29, 78, 216] as const },
    { label: "Completed",        value: done,        color: [21, 128, 61] as const },
    { label: "Overdue",          value: overdue,     color: [185, 28, 28] as const },
  ] as const;

  const kpiW = (CLW - 5 * 3) / 6;
  const kY = 26;
  kpis.forEach((k, i) => {
    kpiBox(doc, ML + i * (kpiW + 3), kY, kpiW, 20, k.label, k.value, k.color);
  });

  // ── project breakdown table ───────────────────────────────────────────────
  let y = kY + 24;

  // Build per-project summary
  const projMap = new Map<string, { total: number; pending: number; underReview: number; inProgress: number; done: number; overdue: number }>();
  tasks.forEach((t) => {
    const key = t.project?.trim() || "Uncategorized";
    if (!projMap.has(key)) projMap.set(key, { total: 0, pending: 0, underReview: 0, inProgress: 0, done: 0, overdue: 0 });
    const s = projMap.get(key)!;
    s.total++;
    if (t.status === "DONE") s.done++;
    else if (t.status === "IN_PROGRESS") s.underReview++;
    else if (t.status === "TODO" && t.managerReviewComments) s.inProgress++;
    else s.pending++;
    if (new Date(t.dueDate) < new Date() && t.status !== "DONE") s.overdue++;
  });

  const projRows = Array.from(projMap.entries())
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));

  const sumCols = ["Project", "Total", "To Do", "Under Review", "In Progress", "Completed", "Overdue"] as const;
  const sumColW = [CLW * 0.36, CLW * 0.1, CLW * 0.1, CLW * 0.12, CLW * 0.12, CLW * 0.12, CLW * 0.1] as const;

  y = drawSectionTitleLandscape(doc, "PROJECT SUMMARY", y, ML, CLW) + 2;

  const thH = 7;
  setFill(doc, [17, 24, 39]);
  doc.rect(ML, y, CLW, thH, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  let cx = ML;
  sumCols.forEach((col, ci) => {
    doc.text(col, cx + 1.5, y + 4.8);
    cx += sumColW[ci];
  });
  setTextColor(doc, DARK);
  y += thH;

  const rowHsm = 6.5;
  projRows.forEach(([proj, s], ri) => {
    if (y + rowHsm > PHL - 12) {
      footerLineLandscape(doc);
      doc.addPage("a4", "landscape");
      y = 10;
    }
    if (ri % 2 === 1) { setFill(doc, LIGHT); doc.rect(ML, y, CLW, rowHsm, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    setDrawColor(doc, [229, 231, 235]);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CLW, rowHsm);
    let ccx = ML;
    const vals: (string | number)[] = [proj, s.total, s.pending, s.underReview, s.inProgress, s.done, s.overdue];
    vals.forEach((val, vi) => {
      doc.text(String(val), ccx + 1.5, y + 4.3);
      if (vi > 0) doc.line(ccx, y, ccx, y + rowHsm);
      ccx += sumColW[vi];
    });
    y += rowHsm;
  });

  y += 6;

  // ── Detailed task table ───────────────────────────────────────────────────
  if (y + 20 > PHL - 12) {
    footerLineLandscape(doc);
    doc.addPage("a4", "landscape");
    y = 10;
  }

  // Column defs for task table
  const taskCols = ["#", "Project", "Task Title", "Assigned To", "Status", "Priority", "Allotted", "Due Date", "Completed", "Days", "Rating"] as const;
  const taskColW = [
    CLW * 0.03,  // #
    CLW * 0.14,  // Project
    CLW * 0.22,  // Task Title
    CLW * 0.10,  // Assigned To
    CLW * 0.09,  // Status
    CLW * 0.07,  // Priority
    CLW * 0.07,  // Allotted
    CLW * 0.09,  // Due Date
    CLW * 0.09,  // Completed
    CLW * 0.05,  // Days
    CLW * 0.05,  // Rating
  ] as const;

  y = drawSectionTitleLandscape(doc, "TASK DETAILS", y, ML, CLW) + 2;

  // Table header
  setFill(doc, [17, 24, 39]);
  doc.rect(ML, y, CLW, thH, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  cx = ML;
  taskCols.forEach((col, ci) => {
    doc.text(col, cx + 1, y + 4.8);
    cx += taskColW[ci];
  });
  setTextColor(doc, DARK);
  y += thH;

  const sortedTasks = [...tasks].sort((a, b) => {
    const aProj = (a.project ?? "").toLowerCase();
    const bProj = (b.project ?? "").toLowerCase();
    if (aProj !== bProj) return aProj.localeCompare(bProj);
    const aDone = a.status === "DONE" ? 1 : 0;
    const bDone = b.status === "DONE" ? 1 : 0;
    return aDone - bDone;
  });

  const rowHT = 7;

  sortedTasks.forEach((task, idx) => {
    if (y + rowHT > PHL - 12) {
      footerLineLandscape(doc);
      doc.addPage("a4", "landscape");
      setFill(doc, BLUE);
      doc.rect(0, 0, PL, 10, "F");
      setTextColor(doc, WHITE);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(`${title} (continued)`, ML, 7);
      setTextColor(doc, DARK);
      y = 14;
      // Repeat header
      setFill(doc, [17, 24, 39]);
      doc.rect(ML, y, CLW, thH, "F");
      setTextColor(doc, WHITE);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      cx = ML;
      taskCols.forEach((col, ci) => {
        doc.text(col, cx + 1, y + 4.8);
        cx += taskColW[ci];
      });
      setTextColor(doc, DARK);
      y += thH;
    }

    if (idx % 2 === 1) { setFill(doc, LIGHT); doc.rect(ML, y, CLW, rowHT, "F"); }

    setDrawColor(doc, [229, 231, 235]);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CLW, rowHT);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);

    const rating = task.ratingEnabled && task.status === "DONE" && task.rating != null ? String(task.rating) : "-";
    const taskVals = [
      String(idx + 1),
      task.project ?? "-",
      task.title,
      task.assignedTo?.name ?? "-",
      statusLabel(task),
      priorityLabel(task.priority),
      fmtDate(task.allocatedAt ?? task.createdAt),
      fmtDate(task.dueDate),
      fmtDate(task.actualCompletedAt),
      task.completionDays != null ? String(task.completionDays) : "-",
      rating,
    ];

    cx = ML;
    taskVals.forEach((val, vi) => {
      const maxW = taskColW[vi] - 2;
      const lines = doc.splitTextToSize(val, maxW) as string[];
      doc.text(lines[0] ?? "", cx + 1, y + 4.3);
      if (vi > 0) doc.line(cx, y, cx, y + rowHT);
      cx += taskColW[vi];
    });

    y += rowHT;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    footerLineLandscape(doc, p, totalPages, PL, PHL);
  }

  const fileProject = projectName && projectName !== "ALL"
    ? projectName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 30)
    : "All_Projects";
  const fileDateRange = fromDate && toDate ? `_${fromDate}_to_${toDate}` : "";
  doc.save(`Report_${fileProject}${fileDateRange}.pdf`);
}

// ─── Landscape helpers ───────────────────────────────────────────────────────

function drawSectionTitleLandscape(doc: jsPDF, text: string, y: number, ml: number, cw: number): number {
  setFill(doc, BLUE);
  doc.rect(ml, y, cw, 6.5, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(text, ml + 2, y + 4.5);
  setTextColor(doc, DARK);
  return y + 6.5;
}

function footerLineLandscape(doc: jsPDF, pageNo?: number, total?: number, pw = 297, ph = 210) {
  setDrawColor(doc, LIGHT);
  doc.setLineWidth(0.2);
  doc.line(ML, ph - 8, pw - MR, ph - 8);
  doc.setFontSize(7);
  setTextColor(doc, MID);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, ML, ph - 4);
  if (pageNo !== undefined && total !== undefined) {
    doc.text(`Page ${pageNo} of ${total}`, pw - MR, ph - 4, { align: "right" });
  }
  setTextColor(doc, DARK);
}
