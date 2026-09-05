import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RowInput } from "jspdf-autotable";
import type { HoursAllEmployeesReportItem } from "./domain";
import { format24HourTime, formatDateDMY, formatDateRangeDMY, formatDisplayDate, leaveTypeShortLabel } from "./hours-format";

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HALF_GAP = 4;
const LEFT_W = (CONTENT_W - HALF_GAP) * 0.58; // Leave Summary carries more columns — give it more room
const RIGHT_W = CONTENT_W - HALF_GAP - LEFT_W;
const RIGHT_X = MARGIN + LEFT_W + HALF_GAP;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
const LIGHT: [number, number, number] = [243, 244, 246];
const WHITE: [number, number, number] = [255, 255, 255];

const TABLE_HEAD_STYLES = {
  fillColor: BRAND,
  textColor: WHITE,
  fontStyle: "bold" as const,
  fontSize: 7,
  minCellHeight: 6,
  cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 }
};

const TABLE_BODY_STYLES = {
  font: "helvetica",
  fontSize: 7,
  textColor: DARK,
  cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
  lineColor: [229, 231, 235] as [number, number, number],
  lineWidth: 0.2,
  minCellHeight: 5.5,
  overflow: "linebreak" as const,
  valign: "middle" as const
};

function setFillColor(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawSectionTitle(doc: jsPDF, text: string, x: number, width: number, y: number): number {
  setFillColor(doc, BRAND);
  doc.rect(x, y, width, 6, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(text, x + width / 2, y + 4.2, { align: "center" });
  setTextColor(doc, DARK);
  return y + 6;
}

/** One combined PDF, matching the client's Excel: Leave Summary and Overtime Summary as two
 *  continuous tables side by side, grouped per employee via row-spanned Sr No / Name cells. */
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

  const employeesWithData = report.employees.filter(
    (employeeReport) => employeeReport.leaveBreakdown.length > 0 || employeeReport.overtimeBreakdown.length > 0
  );

  const leaveBody: RowInput[] = [];
  const overtimeBody: RowInput[] = [];

  employeesWithData.forEach((employeeReport, index) => {
    const srNo = String(index + 1);

    const leaveRows = employeeReport.leaveBreakdown;
    const leaveRowSpan = Math.max(leaveRows.length, 1);
    const srCell = { content: srNo, rowSpan: leaveRowSpan, styles: { halign: "center" as const, valign: "middle" as const } };
    const nameCell = {
      content: employeeReport.employee.name,
      rowSpan: leaveRowSpan,
      styles: { valign: "middle" as const, fontStyle: "bold" as const }
    };
    if (leaveRows.length === 0) {
      leaveBody.push([srCell, nameCell, "-", "-", "-", "-", "-"]);
    } else {
      leaveRows.forEach((leave, leaveIndex) => {
        const row = [
          formatDateRangeDMY(leave.startDate, leave.endDate),
          leaveTypeShortLabel(leave.leaveType),
          leave.reason || "-",
          leave.modification,
          leave.adjustmentAgainst
        ];
        leaveBody.push(leaveIndex === 0 ? [srCell, nameCell, ...row] : row);
      });
    }

    const overtimeRows = employeeReport.overtimeBreakdown;
    if (overtimeRows.length > 0) {
      const overtimeRowSpan = overtimeRows.length;
      const overtimeSrCell = {
        content: srNo,
        rowSpan: overtimeRowSpan,
        styles: { halign: "center" as const, valign: "middle" as const }
      };
      overtimeRows.forEach((overtime, overtimeIndex) => {
        const row = [
          formatDateDMY(overtime.date),
          overtime.project,
          format24HourTime(overtime.startTime),
          format24HourTime(overtime.endTime),
          overtime.durationMinutes > 0 ? overtime.durationLabel : "0",
          overtime.reason || "-"
        ];
        overtimeBody.push(overtimeIndex === 0 ? [overtimeSrCell, ...row] : row);
      });
    }
  });

  let y = 28;
  const leftTitleY = drawSectionTitle(doc, "LEAVE SUMMARY", MARGIN, LEFT_W, y);
  const rightTitleY = drawSectionTitle(doc, "OVERTIME SUMMARY", RIGHT_X, RIGHT_W, y);
  y = Math.max(leftTitleY, rightTitleY);

  autoTable(doc, {
    startY: y,
    head: [["Sr", "Employee", "Date", "Type", "Reason", "Mod.", "Adj."]],
    body:
      leaveBody.length > 0
        ? leaveBody
        : [[{ content: "No approved leave in this period.", colSpan: 7, styles: { halign: "center" as const } }]],
    theme: "grid",
    margin: { left: MARGIN, right: PAGE_W - MARGIN - LEFT_W },
    tableWidth: LEFT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      3: { cellWidth: 9, halign: "center" },
      5: { cellWidth: 9, halign: "center" },
      6: { cellWidth: 9, halign: "center" }
    }
  });

  autoTable(doc, {
    startY: y,
    head: [["Sr", "Date", "Project", "From", "To", "Duration", "Reason"]],
    body:
      overtimeBody.length > 0
        ? overtimeBody
        : [[{ content: "No approved overtime in this period.", colSpan: 7, styles: { halign: "center" as const } }]],
    theme: "grid",
    margin: { left: RIGHT_X, right: MARGIN },
    tableWidth: RIGHT_W,
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES,
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 15, halign: "right" }
    }
  });

  doc.save(`Employee-Hours-Report-${formatDisplayDate(report.period.startDate)}.pdf`);
}
