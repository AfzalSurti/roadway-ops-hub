import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type InfraBillLine = {
  sr: number;
  name: string;
  email: string;
  role: string;
  monthlyCost: number | null;
  daysWorked: number | null;
  amount: number;
  actualAmount?: number | null;
  drawnAmount?: number | null;
  profitLoss?: number;
};

export type InfraOtherCostLine = {
  sr: number;
  description: string;
  actualAmount: number | null;
  drawnAmount: number | null;
  profitLoss: number;
};

export type InfraProjectBillData = {
  projectName: string;
  projectNumber: string;
  unitCode?: string | null;
  generatedAt?: Date;
  lines: InfraBillLine[];
  otherCosts?: InfraOtherCostLine[];
  totalAmount: number;
  totalActualAmount?: number;
  totalDrawnAmount?: number;
  totalProfitLoss?: number;
};

export type InfraSummaryRow = {
  sr: number;
  projectName: string;
  projectNumber: string;
  unitCode?: string | null;
  totalAmount: number;
  totalDrawnAmount?: number;
  totalProfitLoss?: number;
};

const COMPANY = "Geo Designs & Research Pvt. Ltd.";
const BRAND = "#0B3D91";
const ACCENT = "#1F6B2E";

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch("/gdr-logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, logo?: string | null) {
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 14, 10, 22, 22);
    } catch {
      // ignore logo failures
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(BRAND);
  doc.text(COMPANY, logo ? 40 : 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(title, logo ? 40 : 14, 25);
  doc.text(subtitle, logo ? 40 : 14, 30);

  doc.setDrawColor(ACCENT);
  doc.setLineWidth(0.6);
  doc.line(14, 36, 196, 36);
}

export async function downloadInfraProjectBillPdf(data: InfraProjectBillData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  const generatedAt = data.generatedAt ?? new Date();

  drawHeader(
    doc,
    "Infra Project Financial Monitoring",
    `Generated: ${generatedAt.toLocaleDateString("en-IN")}`,
    logo
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Project Details", 14, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Project Name: ${data.projectName}`, 14, 53);
  doc.text(`Project Number: ${data.projectNumber || "-"}`, 14, 59);
  doc.text(`Sub Technical Unit: ${data.unitCode || "-"}`, 14, 65);

  autoTable(doc, {
    startY: 72,
    head: [["Sr.", "Employee", "Email", "Est.", "Actual", "Drawn", "P/L"]],
    body: data.lines.map((line) => [
      String(line.sr),
      line.name,
      line.email || "-",
      formatInr(line.amount),
      line.actualAmount != null ? formatInr(line.actualAmount) : "-",
      line.drawnAmount != null ? formatInr(line.drawnAmount) : "-",
      formatInr(line.profitLoss ?? 0)
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [11, 61, 145], textColor: 255 },
    theme: "grid"
  });

  let finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

  if (data.otherCosts?.length) {
    autoTable(doc, {
      startY: finalY + 8,
      head: [["Sr.", "Other Cost Description", "Actual", "Drawn", "P/L"]],
      body: data.otherCosts.map((line) => [
        String(line.sr),
        line.description,
        line.actualAmount != null ? formatInr(line.actualAmount) : "-",
        line.drawnAmount != null ? formatInr(line.drawnAmount) : "-",
        formatInr(line.profitLoss)
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [31, 107, 46], textColor: 255 },
      theme: "grid"
    });
    finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? finalY;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Total Actual: Rs. ${formatInr(data.totalActualAmount ?? 0)}`, 14, finalY + 10);
  doc.text(`Total Drawn: Rs. ${formatInr(data.totalDrawnAmount ?? 0)}`, 14, finalY + 16);
  doc.text(`Profit / Loss: Rs. ${formatInr(data.totalProfitLoss ?? 0)}`, 14, finalY + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("P/L = Drawn (govt.) − Actual (paid). Estimated staff = (Monthly / 30) × Days.", 14, finalY + 30);

  const safeName = (data.projectNumber || data.projectName || "project").replace(/[^\w.-]+/g, "_");
  doc.save(`Infra_Financial_Monitor_${safeName}.pdf`);
}

export async function downloadInfraProjectsSummaryPdf(rows: InfraSummaryRow[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();
  const totalActual = Number(rows.reduce((sum, row) => sum + row.totalAmount, 0).toFixed(2));
  const totalDrawn = Number(rows.reduce((sum, row) => sum + (row.totalDrawnAmount ?? 0), 0).toFixed(2));
  const totalPl = Number(rows.reduce((sum, row) => sum + (row.totalProfitLoss ?? 0), 0).toFixed(2));

  drawHeader(
    doc,
    "Infra Projects Financial Summary",
    `Generated: ${new Date().toLocaleDateString("en-IN")}`,
    logo
  );

  autoTable(doc, {
    startY: 44,
    head: [["Sr.", "Project Name", "Project Number", "Unit", "Actual", "Drawn", "P/L"]],
    body: rows.map((row) => [
      String(row.sr),
      row.projectName,
      row.projectNumber || "-",
      row.unitCode || "-",
      formatInr(row.totalAmount),
      formatInr(row.totalDrawnAmount ?? 0),
      formatInr(row.totalProfitLoss ?? 0)
    ]),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [11, 61, 145], textColor: 255 },
    foot: [["", "", "", "Total", formatInr(totalActual), formatInr(totalDrawn), formatInr(totalPl)]],
    footStyles: { fillColor: [232, 245, 233], textColor: [31, 107, 46], fontStyle: "bold" },
    theme: "grid"
  });

  doc.save("Infra_Projects_Financial_Summary.pdf");
}

export function downloadInfraProjectBillExcel(data: InfraProjectBillData) {
  const sheetData = [
    [COMPANY],
    ["Infra Project Financial Monitoring"],
    [`Project Name: ${data.projectName}`],
    [`Project Number: ${data.projectNumber || "-"}`],
    [`Sub Technical Unit: ${data.unitCode || "-"}`],
    [],
    ["Sr.", "Employee Name", "Email", "Role", "Monthly Cost", "Days", "Estimated", "Actual", "Drawn", "P/L"],
    ...data.lines.map((line) => [
      line.sr,
      line.name,
      line.email || "-",
      line.role,
      line.monthlyCost ?? "",
      line.daysWorked ?? "",
      line.amount,
      line.actualAmount ?? "",
      line.drawnAmount ?? "",
      line.profitLoss ?? 0
    ]),
    [],
    ["Other Costs"],
    ["Sr.", "Description", "Actual", "Drawn", "P/L"],
    ...(data.otherCosts ?? []).map((line) => [
      line.sr,
      line.description,
      line.actualAmount ?? "",
      line.drawnAmount ?? "",
      line.profitLoss
    ]),
    [],
    ["Total Actual", data.totalActualAmount ?? 0],
    ["Total Drawn", data.totalDrawnAmount ?? 0],
    ["Profit / Loss", data.totalProfitLoss ?? 0]
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, sheet, "Monitoring");
  const safeName = (data.projectNumber || data.projectName || "project").replace(/[^\w.-]+/g, "_");
  XLSX.writeFile(workbook, `Infra_Financial_Monitor_${safeName}.xlsx`);
}

export function downloadInfraProjectsSummaryExcel(rows: InfraSummaryRow[]) {
  const totalActual = Number(rows.reduce((sum, row) => sum + row.totalAmount, 0).toFixed(2));
  const totalDrawn = Number(rows.reduce((sum, row) => sum + (row.totalDrawnAmount ?? 0), 0).toFixed(2));
  const totalPl = Number(rows.reduce((sum, row) => sum + (row.totalProfitLoss ?? 0), 0).toFixed(2));
  const sheetData = [
    [COMPANY],
    ["Infra Projects Financial Summary"],
    [],
    ["Sr.", "Project Name", "Project Number", "Unit", "Actual", "Drawn", "P/L"],
    ...rows.map((row) => [
      row.sr,
      row.projectName,
      row.projectNumber || "-",
      row.unitCode || "-",
      row.totalAmount,
      row.totalDrawnAmount ?? 0,
      row.totalProfitLoss ?? 0
    ]),
    [],
    ["", "", "", "Grand Total", totalActual, totalDrawn, totalPl]
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, sheet, "Summary");
  XLSX.writeFile(workbook, "Infra_Projects_Financial_Summary.xlsx");
}

export function calcInfraAmount(monthlyCost?: number | null, daysWorked?: number | null) {
  const month = typeof monthlyCost === "number" && Number.isFinite(monthlyCost) ? monthlyCost : 0;
  const days = typeof daysWorked === "number" && Number.isFinite(daysWorked) ? daysWorked : 0;
  return Number(((month / 30) * days).toFixed(2));
}
