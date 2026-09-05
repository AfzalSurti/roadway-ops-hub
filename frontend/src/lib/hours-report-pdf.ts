import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HoursAllEmployeesReportItem, HoursEmployeeReportItem } from "./domain";
import { formatDateRange, formatDisplayDate, formatIsoTimeLabel, leaveTypeShortLabel } from "./hours-format";

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PAGE_BOTTOM = 280;
const HALF_GAP = 4;
const LEFT_W = (CONTENT_W - HALF_GAP) / 2;
const RIGHT_W = (CONTENT_W - HALF_GAP) / 2;
const RIGHT_X = MARGIN + LEFT_W + HALF_GAP;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
const LIGHT: [number, number, number] = [243, 244, 246];
const WHITE: [number, number, number] = [255, 255, 255];

const TABLE_HEAD_STYLES = {
  fillColor: BRAND,
  textColor: WHITE,
  fontStyle: "bold" as const,
  fontSize: 6.5,
  minCellHeight: 6,
  cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 }
};

const TABLE_BODY_STYLES = {
  font: "helvetica",
  fontSize: 6.5,
  textColor: DARK,
  cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
  lineColor: [229, 231, 235] as [number, number, number],
  lineWidth: 0.2,
  minCellHeight: 5,
  overflow: "linebreak" as const,
  valign: "middle" as const
};

function setFillColor(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function getLastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return 20;
}

/** Draws one employee's Leave Summary (left) and Overtime Summary (right) side by side. */
function drawEmployeeSection(doc: jsPDF, report: HoursEmployeeReportItem, startY: number): number {
  const rowsNeeded = Math.max(report.leaveBreakdown.length, report.overtimeBreakdown.length, 1);
  let y = ensureSpace(doc, startY, 14 + rowsNeeded * 5);

  setFillColor(doc, LIGHT);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setTextColor(doc, DARK);
  doc.text(report.employee.name, MARGIN + 2, y + 5);
  y += 10;

  const tableTop = y;

  // ─── Left: Leave Summary ─────────────────────────────────────────────
  autoTable(doc, {
    startY: tableTop,
    head: [["Sr", "Date", "Type", "Reason", "Mod.", "Adj."]],
    body:
      report.leaveBreakdown.length > 0
        ? report.leaveBreakdown.map((leave, index) => [
            String(index + 1),
            formatDateRange(leave.startDate, leave.endDate),
            leaveTypeShortLabel(leave.leaveType),
            leave.reason || "-",
            leave.modification,
            leave.adjustmentAgainst
          ])
        : [[{ content: "No approved leave in this period.", colSpan: 6, styles: { halign: "center" as const } }]],
    theme: "grid",
    margin: { left: MARGIN, right: PAGE_W - MARGIN - LEFT_W },
    tableWidth: LEFT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 6, halign: "center" },
      2: { cellWidth: 9, halign: "center" },
      4: { cellWidth: 9, halign: "center" },
      5: { cellWidth: 9, halign: "center" }
    }
  });
  const leftFinalY = getLastTableY(doc);

  // ─── Right: Overtime Summary ────────────────────────────────────────
  autoTable(doc, {
    startY: tableTop,
    head: [["Sr", "Date", "Project", "From", "To", "Duration", "Reason"]],
    body:
      report.overtimeBreakdown.length > 0
        ? report.overtimeBreakdown.map((overtime, index) => [
            String(index + 1),
            formatDisplayDate(overtime.date),
            overtime.project,
            formatIsoTimeLabel(overtime.startTime),
            formatIsoTimeLabel(overtime.endTime),
            overtime.durationMinutes > 0 ? overtime.durationLabel : "-",
            overtime.reason || "-"
          ])
        : [[{ content: "No approved overtime in this period.", colSpan: 7, styles: { halign: "center" as const } }]],
    theme: "grid",
    margin: { left: RIGHT_X, right: MARGIN },
    tableWidth: RIGHT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 6, halign: "center" },
      3: { cellWidth: 13, halign: "center" },
      4: { cellWidth: 13, halign: "center" },
      5: { cellWidth: 15, halign: "right" }
    }
  });
  const rightFinalY = getLastTableY(doc);

  y = Math.max(leftFinalY, rightFinalY) + 3;

  if (report.convertedLeaves.length > 0) {
    y = ensureSpace(doc, y, 6 * report.convertedLeaves.length + 4);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    report.convertedLeaves.forEach((converted) => {
      doc.text(
        `Converted Leave: ${converted.durationLabel} — ${converted.reason} (by ${converted.convertedBy.name}, ${formatDisplayDate(converted.convertedAt)})`,
        MARGIN + 2,
        y
      );
      y += 4.5;
    });
  }

  return y + 6;
}

/** One combined PDF covering every employee for the selected calculation period. */
export function exportAllEmployeesHoursReportPdf(report: HoursAllEmployeesReportItem) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  setFillColor(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 22, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Employee Leave & Overtime Report", MARGIN, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Calculation Period: ${formatDisplayDate(report.period.startDate)} - ${formatDisplayDate(report.period.endDate)}`,
    MARGIN,
    17
  );
  setTextColor(doc, DARK);

  let y = 28;
  report.employees.forEach((employeeReport) => {
    y = drawEmployeeSection(doc, employeeReport, y);
  });

  doc.save(`Employee-Hours-Report-${formatDisplayDate(report.period.startDate)}.pdf`);
}
