import jsPDF from "jspdf";
import type { FinancialPlan, FinancialRaBill } from "./domain";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function shortDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 14;
const MARGIN_Y = 14;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const BRAND = "#1E3A5F";
const BORDER = "#D2D8E0";
const HEADER_BG = "#EEF3FA";

function drawCell(doc: jsPDF, x: number, y: number, w: number, h: number, text: string, opts?: {
  fill?: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  bold?: boolean;
  padding?: number;
}) {
  const align = opts?.align ?? "left";
  const fs = opts?.fontSize ?? 9;
  const pad = opts?.padding ?? 2;

  if (opts?.fill) {
    doc.setFillColor(opts.fill);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(fs);
  doc.setTextColor(25, 25, 25);

  const lines = doc.splitTextToSize(text || "-", Math.max(10, w - pad * 2)) as string[];
  const lineH = fs * 0.45;
  const textY = y + h / 2 + lineH * 0.35;

  if (align === "right") {
    doc.text(lines[0], x + w - pad, textY, { align: "right" });
  } else if (align === "center") {
    doc.text(lines[0], x + w / 2, textY, { align: "center" });
  } else {
    doc.text(lines[0], x + pad, textY);
  }
}

function ensureSpace(doc: jsPDF, cursorY: number, needed: number) {
  if (cursorY + needed <= PAGE_H - MARGIN_Y) return cursorY;
  doc.addPage("a4", "portrait");
  return MARGIN_Y;
}

export function downloadRaBillPdf(params: {
  plan: FinancialPlan;
  projectNumber: string;
  projectName: string;
  contractNumber?: string;
  raBills: FinancialRaBill[];
}) {
  const { plan, projectNumber, projectName, contractNumber, raBills } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN_Y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(BRAND);
  doc.text("RA Bill Log", PAGE_W / 2, y + 2, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10.5);
  doc.text(`Project: ${projectNumber} - ${projectName}`, PAGE_W / 2, y, { align: "center" });
  y += 7;

  drawCell(doc, MARGIN_X, y, CONTENT_W, 8, `Contract No.: ${contractNumber ?? "-"}    Plan ID: ${plan.id}`, {
    fill: HEADER_BG,
    fontSize: 9,
    bold: true
  });
  y += 12;

  raBills.forEach((raBill, index) => {
    y = ensureSpace(doc, y, 95);

    drawCell(doc, MARGIN_X, y, CONTENT_W, 8, `RA Bill ${index + 1}: ${raBill.billName}`, {
      fill: BRAND,
      fontSize: 10,
      bold: true
    });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`RA Bill ${index + 1}: ${raBill.billName}`, MARGIN_X + 2.5, y + 5.2);
    doc.setTextColor(25, 25, 25);
    y += 10;

    // Bill meta (two-column key/value block)
    const leftW = 89;
    const rightW = CONTENT_W - leftW;
    const rowH = 7;
    const leftRows = [
      ["Project Code", projectNumber],
      ["RA Bill Date", shortDate(raBill.createdAt)],
      ["RA Bill No.", raBill.billName],
      ["Status", raBill.status]
    ] as const;
    const rightRows = [
      ["Bill Amount", money(raBill.totalBillAmount)],
      ["Tax/GST", money(raBill.totalTaxAmount)],
      ["Total Bill Amount", money(raBill.totalAmount)],
      ["Received Date", shortDate(raBill.receivedDate)]
    ] as const;

    for (let i = 0; i < leftRows.length; i++) {
      drawCell(doc, MARGIN_X, y + i * rowH, 34, rowH, leftRows[i][0], { fill: HEADER_BG, fontSize: 8.8, bold: true });
      drawCell(doc, MARGIN_X + 34, y + i * rowH, leftW - 34, rowH, leftRows[i][1], { fontSize: 8.8 });

      drawCell(doc, MARGIN_X + leftW, y + i * rowH, 34, rowH, rightRows[i][0], { fill: HEADER_BG, fontSize: 8.8, bold: true });
      drawCell(doc, MARGIN_X + leftW + 34, y + i * rowH, rightW - 34, rowH, rightRows[i][1], {
        fontSize: 8.8,
        align: i >= 0 && i <= 2 ? "right" : "left"
      });
    }
    y += leftRows.length * rowH + 5;

    // Item table
    const widths = [8, 14, 56, 18, 18, 22, 22, 24];
    const headers = ["S.No", "Item", "Particulars", "Item %", "Bill %", "Amount", "Tax", "Total"];
    let x = MARGIN_X;
    for (let i = 0; i < headers.length; i++) {
      drawCell(doc, x, y, widths[i], 8, headers[i], { fill: BRAND, fontSize: 8.4, bold: true, align: "center" });
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.4);
      doc.text(headers[i], x + widths[i] / 2, y + 5.2, { align: "center" });
      doc.setTextColor(25, 25, 25);
      x += widths[i];
    }
    y += 8;

    raBill.items.forEach((item, i) => {
      y = ensureSpace(doc, y, 14);
      const particulars = item.item?.particulars ?? "-";
      const lines = doc.splitTextToSize(particulars, widths[2] - 3.5) as string[];
      const capped = lines.slice(0, 3).join(" ");

      const row = [
        String(i + 1),
        `Item ${item.item?.itemNumber ?? "-"}`,
        capped,
        `${(item.item?.percentage ?? 0).toFixed(2)}%`,
        `${item.billPercentage.toFixed(2)}%`,
        money(item.billAmount),
        money(item.taxAmount),
        money(item.totalAmount)
      ];

      let cx = MARGIN_X;
      for (let c = 0; c < widths.length; c++) {
        drawCell(doc, cx, y, widths[c], 10, row[c], {
          fontSize: 8.2,
          align: c >= 5 ? "right" : c === 0 ? "center" : "left"
        });
        cx += widths[c];
      }
      y += 10;
    });

    drawCell(doc, MARGIN_X, y, widths.slice(0, 5).reduce((a, b) => a + b, 0), 8, "Bill Total", {
      fill: HEADER_BG,
      bold: true,
      fontSize: 9
    });
    drawCell(doc, MARGIN_X + widths.slice(0, 5).reduce((a, b) => a + b, 0), y, widths[5], 8, money(raBill.totalBillAmount), {
      fill: HEADER_BG,
      bold: true,
      fontSize: 9,
      align: "right"
    });
    drawCell(doc, MARGIN_X + widths.slice(0, 6).reduce((a, b) => a + b, 0), y, widths[6], 8, money(raBill.totalTaxAmount), {
      fill: HEADER_BG,
      bold: true,
      fontSize: 9,
      align: "right"
    });
    drawCell(doc, MARGIN_X + widths.slice(0, 7).reduce((a, b) => a + b, 0), y, widths[7], 8, money(raBill.totalAmount), {
      fill: HEADER_BG,
      bold: true,
      fontSize: 9,
      align: "right"
    });
    y += 11;

    // Deduction summary
    const dHeaders = ["Deduction", "%", "Amount"];
    const dRows = [
      ["10% IT", `${raBill.itDeductionPct.toFixed(2)}%`, money(raBill.itDeductionAmount)],
      ["1% L.Cess", `${raBill.lCessDeductionPct.toFixed(2)}%`, money(raBill.lCessDeductionAmount)],
      ["Security Deposit", `${raBill.securityDepositPct.toFixed(2)}%`, money(raBill.securityDepositAmount)],
      ["Recover From RA Bill", `${raBill.recoverFromRaBillPct.toFixed(2)}%`, money(raBill.recoverFromRaBillAmount)],
      ["2% GST Withheld", `${raBill.gstWithheldPct.toFixed(2)}%`, money(raBill.gstWithheldAmount)],
      ["Withheld", `${raBill.withheldPct.toFixed(2)}%`, money(raBill.withheldAmount)]
    ];
    const dx = MARGIN_X;
    const dw = [88, 26, 40];
    for (let i = 0; i < 3; i++) {
      drawCell(doc, dx + dw.slice(0, i).reduce((a, b) => a + b, 0), y, dw[i], 7, dHeaders[i], {
        fill: HEADER_BG,
        bold: true,
        fontSize: 8.6,
        align: i === 0 ? "left" : "center"
      });
    }
    y += 7;

    dRows.forEach((row) => {
      drawCell(doc, dx, y, dw[0], 7, row[0], { fontSize: 8.5 });
      drawCell(doc, dx + dw[0], y, dw[1], 7, row[1], { fontSize: 8.5, align: "center" });
      drawCell(doc, dx + dw[0] + dw[1], y, dw[2], 7, row[2], { fontSize: 8.5, align: "right" });
      y += 7;
    });

    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 4, y - 49, 24, 7, "Cheque", { fill: HEADER_BG, bold: true, fontSize: 8.4, align: "center" });
    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 28, y - 49, 24, 7, "Received", { fill: HEADER_BG, bold: true, fontSize: 8.4, align: "center" });
    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 52, y - 49, 24, 7, "Remark", { fill: HEADER_BG, bold: true, fontSize: 8.4, align: "center" });

    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 4, y - 42, 24, 42, money(raBill.chequeRtgsAmount), { fontSize: 8.2, align: "right" });
    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 28, y - 42, 24, 42, money(raBill.totalReceivedAmount), { fontSize: 8.2, align: "right" });
    drawCell(doc, dx + dw[0] + dw[1] + dw[2] + 52, y - 42, 24, 42, raBill.remark ?? "-", { fontSize: 8.2 });

    y += 6;
  });

  // Grand summary block
  y = ensureSpace(doc, y, 24);
  const totals = {
    bill: raBills.reduce((sum, b) => sum + b.totalBillAmount, 0),
    tax: raBills.reduce((sum, b) => sum + b.totalTaxAmount, 0),
    total: raBills.reduce((sum, b) => sum + b.totalAmount, 0),
    received: raBills.reduce((sum, b) => sum + b.totalReceivedAmount, 0)
  };

  drawCell(doc, MARGIN_X, y, CONTENT_W, 8, "Grand Summary", { fill: BRAND, bold: true, fontSize: 10 });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Grand Summary", MARGIN_X + 2.5, y + 5.2);
  doc.setTextColor(25, 25, 25);
  y += 8;

  const sW = [46, 45, 45, 46];
  const sTitles = ["Total Bill Amount", "Total Tax", "Total Amount", "Total Received"];
  const sVals = [money(totals.bill), money(totals.tax), money(totals.total), money(totals.received)];
  let sx = MARGIN_X;
  for (let i = 0; i < 4; i++) {
    drawCell(doc, sx, y, sW[i], 7, sTitles[i], { fill: HEADER_BG, bold: true, fontSize: 8.5, align: "center" });
    drawCell(doc, sx, y + 7, sW[i], 8, sVals[i], { bold: true, fontSize: 9, align: "right" });
    sx += sW[i];
  }

  const safeProjectNumber = projectNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`RA-Bill-Log_${safeProjectNumber}.pdf`);
}
