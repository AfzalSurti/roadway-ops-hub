import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SubStaffAssignment } from "./domain";
import type { SubStaffPlanRow } from "./domain";

const PAGE_W = 210;
const MARGIN = 14;

const BRAND: [number, number, number] = [11, 31, 58];
const DARK: [number, number, number] = [17, 24, 39];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT: [number, number, number] = [243, 244, 246];

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
  cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
  lineColor: [229, 231, 235] as [number, number, number],
  lineWidth: 0.2,
  minCellHeight: 6,
  overflow: "linebreak" as const,
  valign: "middle" as const
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function sanitizeFilePart(value: string) {
  return value.trim().replace(/[^\w-]+/g, "_").replace(/_+/g, "_") || "report";
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 22, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, MARGIN, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(subtitle, MARGIN, 17);
  doc.setTextColor(...DARK);
}

function drawSummaryStrip(doc: jsPDF, text: string) {
  doc.setFillColor(...LIGHT);
  doc.rect(MARGIN, 26, PAGE_W - MARGIN * 2, 10, "F");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(text, MARGIN + 3, 32);
}

/** One person's full work distribution across every site — meant to be downloaded and sent to them
 * directly so they can see exactly how their time/man-months are split. */
export function downloadStaffDistributionReport(staffName: string, assignments: SubStaffAssignment[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totalMm = assignments.reduce((s, a) => s + a.totalMm, 0);
  const usedMm = assignments.reduce((s, a) => s + a.usedMm, 0);

  drawHeader(doc, "Work Distribution Report", `${staffName} — Generated ${formatDate(new Date().toISOString())}`);
  drawSummaryStrip(
    doc,
    `${assignments.length} assignment(s)   |   Total MM: ${totalMm.toFixed(2)}   |   Used MM: ${usedMm.toFixed(2)}   |   Balance MM: ${(totalMm - usedMm).toFixed(2)}`
  );

  autoTable(doc, {
    startY: 40,
    head: [["Project", "Designation", "Rate", "Total MM", "Used MM", "Balance MM", "Start", "End", "Status"]],
    body: assignments.map((a) => [
      a.siteName || "-",
      a.designation || "-",
      money(a.rate),
      a.totalMm.toFixed(2),
      a.usedMm.toFixed(2),
      (a.totalMm - a.usedMm).toFixed(2),
      formatDate(a.startDate),
      formatDate(a.endDate),
      a.status
    ]),
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES
  });

  doc.save(`Staff-Distribution-${sanitizeFilePart(staffName)}.pdf`);
}

/** Every staff member deployed on one project — a roster for reviewing or sharing. */
export function downloadProjectStaffReport(projectName: string, assignments: SubStaffAssignment[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totalMm = assignments.reduce((s, a) => s + a.totalMm, 0);
  const usedMm = assignments.reduce((s, a) => s + a.usedMm, 0);

  drawHeader(doc, "Project Staff Report", `${projectName} — Generated ${formatDate(new Date().toISOString())}`);
  drawSummaryStrip(
    doc,
    `${assignments.length} staff record(s)   |   Total MM: ${totalMm.toFixed(2)}   |   Used MM: ${usedMm.toFixed(2)}   |   Balance MM: ${(totalMm - usedMm).toFixed(2)}`
  );

  autoTable(doc, {
    startY: 40,
    head: [
      ["Staff Name", "Designation", "Co-Ordinator", "Rate", "Total MM", "Used MM", "Balance MM", "Start", "End", "Status"]
    ],
    body: assignments.map((a) => [
      a.staffName,
      a.designation || "-",
      a.coOrdinator || "-",
      money(a.rate),
      a.totalMm.toFixed(2),
      a.usedMm.toFixed(2),
      (a.totalMm - a.usedMm).toFixed(2),
      formatDate(a.startDate),
      formatDate(a.endDate),
      a.status
    ]),
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES
  });

  doc.save(`Project-Staff-${sanitizeFilePart(projectName)}.pdf`);
}

/** Monthly attendance handoff: every designation planned for a site in the selected month. */
export function downloadSiteMonthlyPlanReport(
  siteName: string,
  year: number,
  month: number,
  rows: SubStaffPlanRow[]
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const totalDays = rows.reduce((sum, row) => sum + row.plannedDaysConstruction + row.plannedDaysDlp, 0);
  drawHeader(doc, "Site Attendance Plan", `${siteName} — ${monthLabel}`);
  drawSummaryStrip(doc, `${rows.length} staff designation record(s)   |   Total planned days: ${totalDays.toFixed(1)}`);
  autoTable(doc, {
    startY: 40,
    head: [["Staff Name", "Designation", "Construction Days", "DLP Days", "Total Days", "Confirmed"]],
    body: rows.map((row) => [
      row.assignment.staffName,
      row.assignment.designation || "-",
      row.plannedDaysConstruction.toFixed(1),
      row.plannedDaysDlp.toFixed(1),
      (row.plannedDaysConstruction + row.plannedDaysDlp).toFixed(1),
      row.autoPlanned ? "No" : "Yes"
    ]),
    theme: "grid",
    margin: { left: MARGIN, right: MARGIN },
    styles: TABLE_BODY_STYLES,
    headStyles: TABLE_HEAD_STYLES
  });
  doc.save(`Attendance-Plan-${sanitizeFilePart(siteName)}-${year}-${String(month).padStart(2, "0")}.pdf`);
}
