import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AssetItem, AssetMaintenanceItem, AssetMovementItem } from "./domain";

type AssetFull = AssetItem & {
  movements: AssetMovementItem[];
  maintenances: AssetMaintenanceItem[];
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BRAND = [11, 31, 58] as const;
const ACCENT = [0, 172, 193] as const;
const DARK = [17, 24, 39] as const;
const MID = [107, 114, 128] as const;
const LIGHT = [243, 244, 246] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [21, 128, 61] as const;
const AMBER = [180, 83, 9] as const;
const RED = [185, 28, 28] as const;
const BLUE = [37, 99, 235] as const;

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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatWarrantyEndDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDate(value);
}

function formatMoney(value: number): string {
  if (!value) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function ensureSpace(doc: jsPDF, currentY: number, needed: number, pageH: number, margin: number): number {
  if (currentY + needed > pageH - margin - 10) {
    doc.addPage("a4", "portrait");
    return margin + 10;
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
  const safe = (text || "—").toString();
  const align = opts?.align ?? "left";
  const lines = doc.splitTextToSize(safe, Math.max(10, w - 4)) as string[];
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
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  setTextColor(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(text, MARGIN + 2, y + 4.8);
  setTextColor(doc, DARK);
  return y + 7;
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
  return status ? status.replace(/_/g, " ") : "—";
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  setDrawColor(doc, LIGHT);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 8, PAGE_W - MARGIN, PAGE_H - 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setTextColor(doc, MID);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}  |  Highway Ops Hub`, MARGIN, PAGE_H - 4);
  doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 4, { align: "right" });
}

export function downloadAssetPdf(asset: AssetItem, options?: { projectName?: string | null }): void {
  const fullAsset = asset as AssetFull;
  const movements = fullAsset.movements ?? [];
  const maintenances = fullAsset.maintenances ?? [];
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  setFillColor(doc, BRAND);
  doc.rect(0, 0, PAGE_W, 28, "F");

  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("JIO RESEARCH & DESIGN", MARGIN, 9);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  setTextColor(doc, ACCENT);
  doc.text("Civil Engineering Consultancy", MARGIN, 15);
  setTextColor(doc, LIGHT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Vadodara, Gujarat, India", MARGIN, 20);

  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ASSET RECORD", PAGE_W - MARGIN, 10, { align: "right" });
  doc.setFontSize(13);
  setTextColor(doc, ACCENT);
  doc.text(asset.assetId, PAGE_W - MARGIN, 18, { align: "right" });

  setDrawColor(doc, ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 31, PAGE_W - MARGIN, 31);

  y = 36;
  y = drawSectionTitle(doc, "ASSET INFORMATION", y) + 2;

  const statusLabel = getAssetStatusLabel(asset.status);
  const statusColor = getAssetStatusColor(asset.status);
  const purchaseDate = formatDate(asset.dateOfPurchase);
  const projectName = options?.projectName?.trim() ? options.projectName : "—";

  const rows = [
    ["Asset ID", asset.assetId, "Asset Class", asset.assetClass],
    ["Mark / Model", asset.markModel ?? "—", "IT Asset ID", asset.itAssetId ?? "—"],
    ["Purchase Date", purchaseDate, "Warranty End Date", formatWarrantyEndDate(asset.warrantyPeriod)],
    ["Purchase Amount", formatMoney(asset.purchaseAmount), "GST", formatMoney(asset.gst)],
    ["Total Amount", formatMoney(asset.totalAmountWithGst), "Project Number", asset.projectNumber ?? "—"],
    ["Project Name", projectName, "Assigned User", asset.assignedUser ?? "—"],
    ["Status", statusLabel, "Remarks", asset.remarks ?? "—"]
  ] as const;

  const rowH = 8;
  const leftLabelW = 33;
  const pairW = CONTENT_W / 2;

  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? LIGHT : WHITE;
    const rowY = y + index * rowH;

    drawCell(doc, MARGIN, rowY, leftLabelW, rowH, row[0], { fill, textColor: MID, bold: true, fontSize: 8 });
    drawCell(doc, MARGIN + leftLabelW, rowY, pairW - leftLabelW, rowH, row[1], {
      fill,
      textColor: row[0] === "Status" ? statusColor : DARK,
      fontSize: 9
    });
    drawCell(doc, MARGIN + pairW, rowY, leftLabelW, rowH, row[2], { fill, textColor: MID, bold: true, fontSize: 8 });
    drawCell(doc, MARGIN + pairW + leftLabelW, rowY, pairW - leftLabelW, rowH, row[3], {
      fill,
      textColor: row[2] === "Status" ? statusColor : DARK,
      fontSize: 9
    });
  });

  y += rows.length * rowH + 6;

  if (movements.length > 0) {
    y = ensureSpace(doc, y, 50, PAGE_H, MARGIN);
    y = drawSectionTitle(doc, "MOVEMENT HISTORY", y) + 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Date of Moving", "Moved To Project", "Moved To User"]],
      body: movements.map((movement, index) => [
        String(index + 1),
        formatDate(movement.dateOfMoving),
        movement.movedToProjectNumber || "—",
        movement.movedToUser || "—"
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: DARK,
        cellPadding: 1.6,
        lineColor: [229, 231, 235],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: BRAND,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8.5
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 40 },
        2: { cellWidth: 70 },
        3: { cellWidth: 60 }
      },
      didDrawPage: (data) => {
        drawFooter(doc, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
        if (data.cursor) {
          y = data.cursor.y + 4;
        }
      }
    });

    y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    y += 6;
  }

  if (maintenances.length > 0) {
    y = ensureSpace(doc, y, 50, PAGE_H, MARGIN);
    y = drawSectionTitle(doc, "MAINTENANCE & FINANCIAL RECORDS", y) + 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "Date", "Repair Cost (incl. GST)", "Depreciation Till Date", "Sell Amount"]],
      body: maintenances.map((maintenance, index) => [
        String(index + 1),
        formatDate(maintenance.dateOfMaintenance),
        formatMoney(maintenance.repairCostInclGst),
        formatMoney(maintenance.depreciationTillDate),
        formatMoney(maintenance.sellAmount)
      ]),
      theme: "grid",
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: DARK,
        cellPadding: 1.6,
        lineColor: [229, 231, 235],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: BRAND,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 8.5
      },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 35 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
        4: { cellWidth: 35 }
      },
      didDrawPage: () => {
        drawFooter(doc, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
      }
    });

    y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    y += 6;

    y = ensureSpace(doc, y, 10, PAGE_H, MARGIN);
    const totalRepair = maintenances.reduce((sum, item) => sum + Number(item.repairCostInclGst || 0), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setTextColor(doc, AMBER);
    doc.text(`Total Repair Cost: ${formatMoney(totalRepair)}`, PAGE_W - MARGIN, y, { align: "right" });
    setTextColor(doc, DARK);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    drawFooter(doc, page, totalPages);
  }

  const safeFileName = `Asset_${sanitizeFilePart(asset.assetId)}_${sanitizeFilePart(asset.assetClass)}`;
  doc.save(`${safeFileName}.pdf`);
}
