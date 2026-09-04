import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HoursReportItem } from "./domain";
import { leaveTypeLabel } from "./hours-format";

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
const MID: [number, number, number] = [107, 114, 128];
const LIGHT: [number, number, number] = [243, 244, 246];
const WHITE: [number, number, number] = [255, 255, 255];

const TABLE_HEAD_STYLES = {
  fillColor: BRAND,
  textColor: WHITE,
  fontStyle: "bold" as const,
  fontSize: 8,
  minCellHeight: 7,
  cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }
};

const TABLE_BODY_STYLES = {
  font: "helvetica",
  fontSize: 8,
  textColor: DARK,
  cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
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

export function exportHoursReportPdf(report: HoursReportItem, employeeName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ─── Header banner ───────────────────────────────────────────────────
  setFillColor(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 24, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Employee Hours Report", MARGIN, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Employee: ${employeeName}`, MARGIN, 18);
  doc.text(
    `Calculation Period: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`,
    MARGIN,
    22.5
  );
  setTextColor(doc, DARK);

  let y = 30;

  // ─── Leave summary ───────────────────────────────────────────────────
  y = drawSectionTitle(doc, "LEAVE SUMMARY", y) + 2;
  autoTable(doc, {
    startY: y,
    head: [["Leave Type", "Count", "Total Hours"]],
    body: [
      ["Full Day", String(report.leave.fullDay.count), report.leave.fullDay.label],
      ["Half Day", String(report.leave.halfDay.count), report.leave.halfDay.label],
      ["Short Leave", String(report.leave.shortLeave.count), report.leave.shortLeave.label],
      [
        { content: "Total", styles: { fontStyle: "bold" } },
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
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } }
  });
  y = getLastTableY(doc) + 8;

  // ─── Overtime summary ─────────────────────────────────────────────────
  y = drawSectionTitle(doc, "OVERTIME SUMMARY", y) + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Approved Overtime: ${report.approvedOvertimeLabel}`, MARGIN + 2, y);
  doc.setFont("helvetica", "normal");
  y += 8;

  // ─── Date-wise breakdown (flat, one row per approved record) ──────────
  type BreakdownRow = { date: string; type: string; duration: string; covered: string };
  const rows: BreakdownRow[] = [
    ...report.leaveBreakdown.map((row) => ({
      date: row.date,
      type: `${leaveTypeLabel(row.leaveType)} Leave`,
      duration: row.durationLabel,
      covered: row.coveredLabel
    })),
    ...report.overtimeBreakdown.map((row) => ({
      date: row.date,
      type: "Overtime",
      duration: row.durationLabel,
      covered: row.appliedLabel
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (rows.length > 0) {
    y = drawSectionTitle(doc, "DATE-WISE BREAKDOWN", y) + 2;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Type", "Duration", "Status", "Covered"]],
      body: rows.map((row) => [formatDate(row.date), row.type, row.duration, "Approved", row.covered]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: TABLE_BODY_STYLES,
      headStyles: TABLE_HEAD_STYLES,
      alternateRowStyles: { fillColor: LIGHT }
    });
    y = getLastTableY(doc) + 8;
  }

  // ─── Final calculation ──────────────────────────────────────────────────
  y = drawSectionTitle(doc, "FINAL CALCULATION", y) + 6;
  const lines: Array<[string, string]> = [
    ["Total Leave", report.leave.totalLabel],
    ["Total Approved Overtime", report.approvedOvertimeLabel],
    [report.remainingMinutes >= 0 ? "Remaining Leave Hours" : "Surplus Overtime Hours", report.remainingLabel.replace("-", "")]
  ];
  doc.setFontSize(10);
  lines.forEach(([label, value], index) => {
    const rowY = y + index * 7;
    doc.setFont("helvetica", "normal");
    setTextColor(doc, MID);
    doc.text(label, MARGIN + 2, rowY);
    doc.setFont("helvetica", "bold");
    setTextColor(doc, DARK);
    doc.text(value, PAGE_W - MARGIN - 2, rowY, { align: "right" });
  });

  doc.save(`Hours-Report-${employeeName.replace(/\s+/g, "_")}-${formatDate(report.period.startDate)}.pdf`);
}
