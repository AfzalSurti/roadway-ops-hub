import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatAssetProjectLabel } from "@/hooks/useAssetCatalog";
import type { AssetItem, AssetMaintenanceItem, AssetMovementItem } from "./domain";

type AssetFull = AssetItem & {
  movements: AssetMovementItem[];
  maintenances: AssetMaintenanceItem[];
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COMPANY_NAME = "GEO DESIGNS & RESEARCH PVT. LTD";
const COMPANY_TAGLINE = "Precision in Design. Excellence in Delivery.";
const COMPANY_LOCATION = "Vadodara, Gujarat, India";

const BRAND = [11, 31, 58] as const;
const BRAND_LIGHT = [15, 45, 82] as const;
const ACCENT = [0, 172, 193] as const;
const DARK = [17, 24, 39] as const;
const MID = [107, 114, 128] as const;
const LIGHT = [243, 244, 246] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [21, 128, 61] as const;
const AMBER = [180, 83, 9] as const;
const RED = [185, 28, 28] as const;
const BLUE = [37, 99, 235] as const;

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

function setFillColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setTextColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function formatDate(value?: string | Date | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatWarrantyEndDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDate(value);
}

/** jsPDF Helvetica cannot render ₹ — use Rs. prefix with Indian grouping instead. */
function formatMoney(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  const amount = Number(value);
  if (amount === 0) {
    return "Rs. 0.00";
  }
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
  return `Rs. ${formatted}`;
}

function ensureSpace(doc: jsPDF, currentY: number, needed: number, pageH: number, margin: number): number {
  if (currentY + needed > pageH - margin - 12) {
    doc.addPage("a4", "portrait");
    return margin + 8;
  }
  return currentY;
}

function sanitizeFilePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: {
    fill?: readonly [number, number, number];
    textColor?: readonly [number, number, number];
    align?: "left" | "center" | "right";
    fontSize?: number;
    bold?: boolean;
  }
) {
  if (opts?.fill) {
    setFillColor(doc, opts.fill);
    doc.rect(x, y, w, h, "F");
  }
  setDrawColor(doc, [229, 231, 235]);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(opts?.fontSize ?? 9);
  setTextColor(doc, opts?.textColor ?? DARK);
  const safe = (text || "-").toString();
  const align = opts?.align ?? "left";
  const lines = doc.splitTextToSize(safe, Math.max(8, w - 4)) as string[];
  const lineH = (opts?.fontSize ?? 9) * 0.42;
  const textH = lines.length * lineH;
  const textY = y + (h - textH) / 2 + lineH * 0.82;
  if (align === "right") {
    doc.text(lines, x + w - 2, textY, { align: "right" });
  } else if (align === "center") {
    doc.text(lines, x + w / 2, textY, { align: "center" });
  } else {
    doc.text(lines, x + 2, textY);
  }
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  setFillColor(doc, BRAND);
  doc.roundedRect(MARGIN, y, CONTENT_W, 6.5, 1, 1, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(text, MARGIN + 3, y + 4.3);
  setTextColor(doc, DARK);
  return y + 6.5;
}

function getAssetStatusColor(status?: string): readonly [number, number, number] {
  if (status === "IN_USE") return GREEN;
  if (status === "IN_STORE") return BLUE;
  if (status === "UNDER_REPAIR") return AMBER;
  if (status === "DISPOSED") return RED;
  return MID;
}

function getAssetStatusLabel(status?: string): string {
  if (status === "DISPOSED") return "SOLD";
  return status ? status.replace(/_/g, " ") : "-";
}

function drawHeader(doc: jsPDF, asset: AssetItem) {
  setFillColor(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 32, "F");
  setFillColor(doc, ACCENT);
  doc.rect(0, 32, PAGE_W, 1.2, "F");

  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY_NAME, MARGIN, 10);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  setTextColor(doc, ACCENT);
  doc.text(COMPANY_TAGLINE, MARGIN, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, LIGHT);
  doc.text(COMPANY_LOCATION, MARGIN, 21.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setTextColor(doc, WHITE);
  doc.text("ASSET RECORD", PAGE_W - MARGIN, 10, { align: "right" });

  doc.setFontSize(12);
  setTextColor(doc, ACCENT);
  doc.text(asset.assetId, PAGE_W - MARGIN, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, LIGHT);
  const subtitle = `${asset.assetClass} / ${asset.assetType}`;
  doc.text(subtitle, PAGE_W - MARGIN, 23, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  setDrawColor(doc, LIGHT);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, MID);
  doc.text(`${COMPANY_NAME}  |  Generated ${new Date().toLocaleString("en-IN")}`, MARGIN, PAGE_H - 5.5);
  doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: "right" });
}

function drawSummaryStrip(doc: jsPDF, label: string, value: string, y: number): number {
  const stripH = 9;
  setFillColor(doc, [254, 243, 199]);
  setDrawColor(doc, [251, 191, 36]);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, stripH, 1, 1, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor(doc, AMBER);
  doc.text(label, MARGIN + 4, y + 5.8);
  doc.text(value, PAGE_W - MARGIN - 4, y + 5.8, { align: "right" });
  setTextColor(doc, DARK);
  return y + stripH + 4;
}

function getLastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? MARGIN;
}

export function downloadAssetPdf(asset: AssetItem, options?: { projectName?: string | null }): void {
  const fullAsset = asset as AssetFull;
  const movements = fullAsset.movements ?? [];
  const maintenances = fullAsset.maintenances ?? [];
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  drawHeader(doc, asset);
  let y = 38;
  y = drawSectionTitle(doc, "ASSET INFORMATION", y) + 2;

  const statusLabel = getAssetStatusLabel(asset.status);
  const statusColor = getAssetStatusColor(asset.status);
  const purchaseDate = formatDate(asset.dateOfPurchase);
  const projectName = options?.projectName?.trim() ? options.projectName : "-";

  const rows = [
    ["Asset ID", asset.assetId, "Asset Class", asset.assetClass],
    ["Asset Type", asset.assetType, "Mark / Model", asset.markModel ?? "-"],
    ["Purchase Date", purchaseDate, "Warranty End Date", formatWarrantyEndDate(asset.warrantyPeriod)],
    ["Purchase Amount", formatMoney(asset.purchaseAmount), "GST", formatMoney(asset.gst)],
    ["Total Amount", formatMoney(asset.totalAmountWithGst), "Current Value", formatMoney(asset.currentValue)],
    ["Project Number", asset.projectNumber ?? "-", "Project Name", projectName],
    ["Assigned User", asset.assignedUser ?? "-", "Assigned Date", formatDate(asset.assignedDate)],
    ["Status", statusLabel, "Remarks", asset.remarks ?? "-"],
    ["Sold Amount", formatMoney(asset.soldAmount), "Sold Remark", asset.soldRemark ?? "-"]
  ] as const;

  const rowH = 7.5;
  const leftLabelW = 32;
  const pairW = CONTENT_W / 2;

  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? LIGHT : WHITE;
    const rowY = y + index * rowH;

    drawCell(doc, MARGIN, rowY, leftLabelW, rowH, row[0], { fill, textColor: MID, bold: true, fontSize: 7.5 });
    drawCell(doc, MARGIN + leftLabelW, rowY, pairW - leftLabelW, rowH, row[1], {
      fill,
      textColor: row[0] === "Status" ? statusColor : DARK,
      fontSize: 8.5,
      bold: row[0] === "Status"
    });
    drawCell(doc, MARGIN + pairW, rowY, leftLabelW, rowH, row[2], { fill, textColor: MID, bold: true, fontSize: 7.5 });
    drawCell(doc, MARGIN + pairW + leftLabelW, rowY, pairW - leftLabelW, rowH, row[3], {
      fill,
      textColor: row[2] === "Status" ? statusColor : DARK,
      fontSize: 8.5,
      bold: row[2] === "Status"
    });
  });

  y += rows.length * rowH + 8;

  if (movements.length > 0) {
    y = ensureSpace(doc, y, 40, PAGE_H, MARGIN);
    y = drawSectionTitle(doc, "MOVEMENT HISTORY", y) + 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Old Project", "Transferred Project", "Assigned", "Moved", "Old User", "New User"]],
      body: movements.map((movement, index) => [
        String(index + 1),
        formatAssetProjectLabel(movement.previousProjectNumber, movement.previousProjectName) || "-",
        formatAssetProjectLabel(movement.movedToProjectNumber, movement.movedToProjectName) || "-",
        formatDate(movement.previousAssignedDate),
        formatDate(movement.dateOfMoving),
        movement.previousUser || "-",
        movement.movedToUser || "-"
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: TABLE_BODY_STYLES,
      headStyles: TABLE_HEAD_STYLES,
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 20 },
        6: { cellWidth: 42 }
      }
    });

    y = getLastTableY(doc) + 8;
  }

  if (maintenances.length > 0) {
    y = ensureSpace(doc, y, 45, PAGE_H, MARGIN);
    y = drawSectionTitle(doc, "MAINTENANCE & FINANCIAL RECORDS", y) + 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Date", "Project No.", "Project Name", "Repair Cost", "Remark"]],
      body: maintenances.map((maintenance, index) => [
        String(index + 1),
        formatDate(maintenance.dateOfMaintenance),
        maintenance.projectNumber || "-",
        maintenance.projectName || "-",
        formatMoney(maintenance.repairCostInclGst),
        maintenance.remark || "-"
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: TABLE_BODY_STYLES,
      headStyles: TABLE_HEAD_STYLES,
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 42 },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 52 }
      }
    });

    y = getLastTableY(doc) + 4;
    y = ensureSpace(doc, y, 14, PAGE_H, MARGIN);

    const totalRepair = maintenances.reduce((sum, item) => sum + Number(item.repairCostInclGst || 0), 0);
    y = drawSummaryStrip(doc, "Total Repair Cost (incl. GST)", formatMoney(totalRepair), y);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    drawFooter(doc, page, totalPages);
  }

  const safeFileName = `Asset_${sanitizeFilePart(asset.assetId)}_${sanitizeFilePart(asset.assetClass)}`;
  doc.save(`${safeFileName}.pdf`);
}
