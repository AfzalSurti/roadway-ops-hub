import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HoursAllEmployeesReportItem, HoursEmployeeReportItem, HoursLeaveBreakdownRow, LeaveType } from "./domain";
import { buildBreakdownRows, formatDateRange, formatIsoTimeLabel, leaveTypeLabel, minutesToLabel } from "./hours-format";

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = 280;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
const MID: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [243, 244, 246];
const WHITE: [number, number, number] = [255, 255, 255];

const TABLE_HEAD_STYLES = {
  fillColor: BRAND,
  textColor: WHITE,
  fontStyle: "bold" as const,
  fontSize: 7.5,
  minCellHeight: 6.5,
  cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 }
};

const TABLE_BODY_STYLES = {
  font: "helvetica",
  fontSize: 7.5,
  textColor: DARK,
  cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
  lineColor: [229, 231, 235] as [number, number, number],
  lineWidth: 0.2,
  minCellHeight: 6,
  overflow: "linebreak" as const,
  valign: "middle" as const
};

function setFillColor(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getLastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  setFillColor(doc, BRAND);
  doc.rect(MARGIN, y, CONTENT_W, 6.5, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(text, MARGIN + 2, y + 4.5);
  setTextColor(doc, DARK);
  return y + 6.5;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return 20;
}

const LEAVE_TYPES_ORDER: LeaveType[] = ["FULL_DAY", "HALF_DAY", "SHORT_LEAVE"];

function aggregateLeaveByType(leaveBreakdown: HoursLeaveBreakdownRow[]) {
  return LEAVE_TYPES_ORDER.map((type) => {
    const rows = leaveBreakdown.filter((row) => row.leaveType === type);
    const numberOfDays = rows.reduce((sum, row) => sum + row.numberOfDays, 0);
    const minutes = rows.reduce((sum, row) => sum + row.durationMinutes, 0);
    const dates = rows.map((row) => formatDateRange(row.startDate, row.endDate)).join(", ");
    return { type, dates: dates || "-", numberOfDays, minutes };
  });
}

function drawEmployeeSection(doc: jsPDF, report: HoursEmployeeReportItem, startY: number): number {
  let y = ensureSpace(doc, startY, 20);

  setFillColor(doc, LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, DARK);
  doc.text(`Employee: ${report.employee.name}`, MARGIN + 2, y + 5.5);
  y += 12;

  // Leave summary
  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, "LEAVE SUMMARY", y) + 2;
  const leaveRows = aggregateLeaveByType(report.leaveBreakdown);
  autoTable(doc, {
    startY: y,
    head: [["Leave Type", "Dates", "Number of Days", "Hours"]],
    body: [
      ...leaveRows.map((row) => [leaveTypeLabel(row.type), row.dates, String(row.numberOfDays), minutesToLabel(row.minutes)]),
      [
        { content: "Total", styles: { fontStyle: "bold" } },
        "",
        { content: String(report.leave.totalCount), styles: { fontStyle: "bold" } },
        { content: report.leave.totalLabel, styles: { fontStyle: "bold" } }
      ]
    ],
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 2: { halign: "center", cellWidth: 26 }, 3: { halign: "right", cellWidth: 26 } }
  });
  y = getLastTableY(doc) + 6;

  // Overtime summary
  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, "OVERTIME SUMMARY", y) + 2;
  const approvedOvertime = report.overtimeBreakdown;
  if (approvedOvertime.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("No approved overtime in this period.", MARGIN + 2, y + 4);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Project", "From", "To", "Duration", "Reason"]],
      body: approvedOvertime.map((row) => [
        formatDate(row.date),
        row.project,
        formatIsoTimeLabel(row.startTime),
        formatIsoTimeLabel(row.endTime),
        row.durationLabel,
        row.reason
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: TABLE_BODY_STYLES,
      headStyles: TABLE_HEAD_STYLES,
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 4: { halign: "right", cellWidth: 20 } }
    });
    y = getLastTableY(doc) + 6;
  }
  y = ensureSpace(doc, y, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Approved Overtime: ${report.approvedOvertimeLabel}`, MARGIN + 2, y);
  y += 8;

  // Date-wise coverage
  const breakdownRows = buildBreakdownRows(report);
  if (breakdownRows.length > 0) {
    y = ensureSpace(doc, y, 30);
    y = drawSectionTitle(doc, "DATE-WISE COVERAGE", y) + 2;
    autoTable(doc, {
      startY: y,
      head: [["Leave Date", "Leave", "Leave Hours", "Overtime Date", "Overtime Hours", "Coverage"]],
      body: breakdownRows.map((row) => [
        row.leaveDate ? formatDate(row.leaveDate) : "-",
        row.leaveLabel ?? "-",
        row.leaveHours ?? "-",
        row.overtimeDate ? formatDate(row.overtimeDate) : "-",
        row.overtimeHours ?? "-",
        row.coverage
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: TABLE_BODY_STYLES,
      headStyles: TABLE_HEAD_STYLES,
      alternateRowStyles: { fillColor: LIGHT }
    });
    y = getLastTableY(doc) + 6;
  }

  // Final calculation
  y = ensureSpace(doc, y, 26);
  y = drawSectionTitle(doc, "FINAL CALCULATION", y) + 5;
  const lines: Array<[string, string]> = [
    ["Total Leave", report.leave.totalLabel],
    ["Approved Overtime", report.approvedOvertimeLabel],
    [report.remainingMinutes >= 0 ? "Remaining" : "Surplus Overtime", report.remainingLabel.replace("-", "")]
  ];
  doc.setFontSize(9);
  lines.forEach(([label, value], index) => {
    const rowY = y + index * 6;
    doc.setFont("helvetica", "normal");
    setTextColor(doc, MID);
    doc.text(label, MARGIN + 2, rowY);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, DARK);
    doc.text(value, PAGE_W - MARGIN - 2, rowY, { align: "right" });
  });

  return y + lines.length * 6 + 6;
}

/** One combined PDF covering every employee for the selected calculation period. */
export function exportAllEmployeesHoursReportPdf(report: HoursAllEmployeesReportItem) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  setFillColor(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 24, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Employee Leave & Overtime Report", MARGIN, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Calculation Period: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`,
    MARGIN,
    19
  );
  setTextColor(doc, DARK);

  let y = 30;
  y = drawSectionTitle(doc, "EMPLOYEE SUMMARY", y) + 2;
  autoTable(doc, {
    startY: y,
    head: [
      ["Sr.", "Employee", "Full Day", "Half Day", "Short Leave", "Total Leave", "Approved Overtime", "Remaining"]
    ],
    body: report.employees.map((employeeReport, index) => [
      String(index + 1),
      employeeReport.employee.name,
      String(employeeReport.leave.fullDay.count),
      String(employeeReport.leave.halfDay.count),
      String(employeeReport.leave.shortLeave.count),
      employeeReport.leave.totalLabel,
      employeeReport.approvedOvertimeLabel,
      employeeReport.remainingLabel
    ]),
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" }
    }
  });
  y = getLastTableY(doc) + 10;

  report.employees.forEach((employeeReport) => {
    doc.addPage();
    y = 20;
    y = drawEmployeeSection(doc, employeeReport, y);
  });

  doc.save(`Employee-Hours-Report-${formatDate(report.period.startDate)}.pdf`);
}
