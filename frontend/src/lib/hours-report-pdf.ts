import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { HoursAllEmployeesReportItem } from "./domain";
import { formatDateRange, formatDisplayDate, formatIsoTimeLabel, leaveTypeShortLabel } from "./hours-format";

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
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

type Row = {
  employee: string;
  type: string;
  date: string;
  details: string;
  fromTo: string;
  duration: string;
  modification: string;
  adjustment: string;
  sortKey: number;
};

/** One combined PDF, one flat table covering every employee's leave, overtime, and converted-leave rows. */
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

  const rows: Row[] = [];

  report.employees.forEach((employeeReport) => {
    employeeReport.leaveBreakdown.forEach((leave) => {
      rows.push({
        employee: employeeReport.employee.name,
        type: leaveTypeShortLabel(leave.leaveType),
        date: formatDateRange(leave.startDate, leave.endDate),
        details: leave.reason || "-",
        fromTo: "-",
        duration: leave.durationLabel,
        modification: leave.modification,
        adjustment: leave.adjustmentAgainst,
        sortKey: new Date(leave.startDate).getTime()
      });
    });

    employeeReport.overtimeBreakdown.forEach((overtime) => {
      rows.push({
        employee: employeeReport.employee.name,
        type: "Overtime",
        date: formatDisplayDate(overtime.date),
        details: `${overtime.project} — ${overtime.reason || "-"}`,
        fromTo: `${formatIsoTimeLabel(overtime.startTime)}-${formatIsoTimeLabel(overtime.endTime)}`,
        duration: overtime.durationMinutes > 0 ? overtime.durationLabel : "-",
        modification: "-",
        adjustment: "-",
        sortKey: new Date(overtime.date).getTime()
      });
    });

    employeeReport.convertedLeaves.forEach((converted) => {
      rows.push({
        employee: employeeReport.employee.name,
        type: "Converted Leave",
        date: formatDisplayDate(converted.convertedAt),
        details: `${converted.reason} (by ${converted.convertedBy.name})`,
        fromTo: "-",
        duration: converted.durationLabel,
        modification: "OL",
        adjustment: "OL",
        sortKey: new Date(converted.convertedAt).getTime()
      });
    });
  });

  rows.sort((a, b) => a.employee.localeCompare(b.employee) || a.sortKey - b.sortKey);

  autoTable(doc, {
    startY: 28,
    head: [["Sr", "Employee", "Type", "Date", "Details", "From-To", "Duration", "Mod.", "Adj."]],
    body:
      rows.length > 0
        ? rows.map((row, index) => [
            String(index + 1),
            row.employee,
            row.type,
            row.date,
            row.details,
            row.fromTo,
            row.duration,
            row.modification,
            row.adjustment
          ])
        : [[{ content: "No approved leave or overtime in this period.", colSpan: 9, styles: { halign: "center" as const } }]],
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 16 },
      3: { cellWidth: 24 },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 10, halign: "center" },
      8: { cellWidth: 10, halign: "center" }
    }
  });

  doc.save(`Employee-Hours-Report-${formatDisplayDate(report.period.startDate)}.pdf`);
}
