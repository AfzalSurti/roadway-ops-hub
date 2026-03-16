import jsPDF from "jspdf";
import type { FinancialPlan, FinancialRaBill } from "./domain";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function shortDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function n2(value: number) {
  return value.toFixed(2);
}

/** Draw a cell with border and optional background fill */
function cell(doc: jsPDF, x: number, y: number, w: number, h: number, text: string, opts?: {
  fontSize?: number;
  bold?: boolean;
  fill?: string;
  textColor?: string;
  align?: "left" | "center" | "right";
  wrap?: boolean;
  padding?: number;
}) {
  const fs = opts?.fontSize ?? 7.5;
  const pad = opts?.padding ?? 1.8;
  const align = opts?.align ?? "left";
  const wrap = opts?.wrap ?? true;

  if (opts?.fill) {
    doc.setFillColor(opts.fill);
    doc.rect(x, y, w, h, "F");
  }

  doc.setDrawColor("#cccccc");
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setFontSize(fs);
  if (opts?.bold) {
    doc.setFont("helvetica", "bold");
  } else {
    doc.setFont("helvetica", "normal");
  }

  if (opts?.textColor) {
    const hex = opts.textColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setTextColor(r, g, b);
  } else {
    doc.setTextColor(30, 30, 30);
  }

  const usableW = w - pad * 2;
  const lines: string[] = wrap ? (doc.splitTextToSize(text, usableW) as string[]) : [text];
  const lineH = fs * 0.45;
  const textBlockH = lines.length * lineH;
  const startY = y + (h - textBlockH) / 2 + lineH * 0.85;

  if (align === "center") {
    doc.text(lines, x + w / 2, startY, { align: "center" });
  } else if (align === "right") {
    doc.text(lines, x + w - pad, startY, { align: "right" });
  } else {
    doc.text(lines, x + pad, startY);
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
}

/** Columns for the RA bill table (portrait A4, margin 10mm each side = 190mm usable) */
// Total usable: 190mm
// S.No | Project Code | Contract No | RA Bill Date | RA Bill No | Bill Description |
//   RA Bill Amount | GST | Total Bill | Received Date | Cheque/RTGS | IT | L.Cess |
//   Security Deposit | Recover | GST Withheld | Withheld Amount | Total Received | Status | Remark

const COLS = [
  { label: "S.No", w: 8 },
  { label: "Project Code", w: 18 },
  { label: "Contract No.", w: 22 },
  { label: "RA Bill Date", w: 18 },
  { label: "RA Bill No.", w: 16 },
  { label: "Bill Description", w: 26 },
  { label: "RA Bill Amount", w: 18 },
  { label: "Tax/GST", w: 14 },
  { label: "Total Bill Amount", w: 18 },
  { label: "Received Date", w: 18 },
  { label: "Cheque/RTGS Amount", w: 20 },
  { label: "10% IT", w: 14 },
  { label: "1% L.Cess", w: 14 },
  { label: "Security Deposit", w: 18 },
  { label: "Recover From RA Bill", w: 20 },
  { label: "2% GST Withheld", w: 18 },
  { label: "Withheld Amount", w: 18 },
  { label: "Total Received Amount", w: 22 },
  { label: "Status", w: 14 },
  { label: "Remark", w: 20 }
] as const;

// Total width for landscape: 297 - 20 = 277mm
// Let's recalculate to fit properly
const COL_WIDTHS = [8, 18, 22, 18, 16, 26, 18, 14, 18, 18, 20, 14, 14, 18, 20, 18, 18, 22, 14, 20];
// Sum = 8+18+22+18+16+26+18+14+18+18+20+14+14+18+20+18+18+22+14+20 = 362

// We'll use landscape A4 which is 297x210mm, usable width 277mm after 10mm margins
// Scale factor: 277/362 = 0.765
const SCALE = 277 / COL_WIDTHS.reduce((a, b) => a + b, 0);
const SCALED_WIDTHS = COL_WIDTHS.map((w) => Number((w * SCALE).toFixed(2)));

const COL_LABELS = [
  "S.No",
  "Project Code",
  "Contract No.",
  "RA Bill Date",
  "RA Bill No.",
  "Bill Description",
  "RA Bill / Put up\nContract Bill Amount",
  "Tax/GST",
  "Total Bill Amount",
  "Received Date",
  "Cheque/RTGS Amount",
  "10% IT",
  "1% L.Cess",
  "Security Deposit",
  "Recover From\nRA Bill",
  "2% GST Withheld",
  "Withheld Amount",
  "Total Received\nAmount",
  "Status",
  "Remark"
];

const HEADER_H = 14;
const ROW_H = 10;
const MARGIN_X = 10;
const MARGIN_Y = 10;

export function downloadRaBillPdf(params: {
  plan: FinancialPlan;
  projectNumber: string;
  projectName: string;
  contractNumber?: string;
  raBills: FinancialRaBill[];
}) {
  const { plan, projectNumber, projectName, contractNumber, raBills } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ---- Title area ----
  let curY = MARGIN_Y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("RA Bill Log", 148.5, curY + 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Project: ${projectNumber} · ${projectName}`, 148.5, curY + 10, { align: "center" });

  curY += 16;

  // ---- Table header ----
  let hx = MARGIN_X;
  for (let i = 0; i < SCALED_WIDTHS.length; i++) {
    const w = SCALED_WIDTHS[i];
    cell(doc, hx, curY, w, HEADER_H, COL_LABELS[i], {
      fontSize: 6.5,
      bold: true,
      fill: "#1e3a5f",
      textColor: "#ffffff",
      align: "center",
      wrap: true
    });
    hx += w;
  }

  curY += HEADER_H;

  // ---- Rows ----
  raBills.forEach((raBill, rowIndex) => {
    const billDescription = raBill.items
      .map((item) => `Item ${item.item?.itemNumber ?? "?"}: ${n2(item.billPercentage)}% of ${n2(item.item?.percentage ?? 0)}%`)
      .join("; ");

    const values: string[] = [
      String(rowIndex + 1),
      projectNumber,
      contractNumber ?? "-",
      shortDate(raBill.createdAt),
      raBill.billName,
      billDescription,
      money(raBill.totalBillAmount),
      money(raBill.totalTaxAmount),
      money(raBill.totalAmount),
      shortDate(raBill.receivedDate),
      raBill.chequeRtgsAmount > 0 ? money(raBill.chequeRtgsAmount) : "-",
      raBill.itDeductionAmount > 0 ? money(raBill.itDeductionAmount) : "-",
      raBill.lCessDeductionAmount > 0 ? money(raBill.lCessDeductionAmount) : "-",
      raBill.securityDepositAmount > 0 ? money(raBill.securityDepositAmount) : "-",
      raBill.recoverFromRaBillAmount > 0 ? money(raBill.recoverFromRaBillAmount) : "-",
      raBill.gstWithheldAmount > 0 ? money(raBill.gstWithheldAmount) : "-",
      raBill.withheldAmount > 0 ? money(raBill.withheldAmount) : "-",
      raBill.totalReceivedAmount > 0 ? money(raBill.totalReceivedAmount) : "-",
      raBill.status === "RECEIVED" ? "Received" : raBill.status === "PUT_UP" ? "Put Up" : "Planning",
      raBill.remark ?? "-"
    ];

    const rowFill = rowIndex % 2 === 0 ? "#f8faff" : "#ffffff";
    let rx = MARGIN_X;

    for (let c = 0; c < SCALED_WIDTHS.length; c++) {
      const w = SCALED_WIDTHS[c];
      cell(doc, rx, curY, w, ROW_H, values[c], {
        fontSize: 6.2,
        fill: rowFill,
        align: c === 0 ? "center" : c >= 6 && c <= 17 ? "right" : "left",
        wrap: c === 5 || c === 19
      });
      rx += w;
    }

    curY += ROW_H;

    // Add new page if needed
    if (curY > 185 && rowIndex < raBills.length - 1) {
      doc.addPage("a4", "landscape");
      curY = MARGIN_Y;

      hx = MARGIN_X;
      for (let i = 0; i < SCALED_WIDTHS.length; i++) {
        const w = SCALED_WIDTHS[i];
        cell(doc, hx, curY, w, HEADER_H, COL_LABELS[i], {
          fontSize: 6.5,
          bold: true,
          fill: "#1e3a5f",
          textColor: "#ffffff",
          align: "center",
          wrap: true
        });
        hx += w;
      }
      curY += HEADER_H;
    }
  });

  // ---- Summary row ----
  const totalBillAmt = raBills.reduce((s, b) => s + b.totalBillAmount, 0);
  const totalTaxAmt = raBills.reduce((s, b) => s + b.totalTaxAmount, 0);
  const totalAmt = raBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalCheque = raBills.reduce((s, b) => s + b.chequeRtgsAmount, 0);
  const totalIT = raBills.reduce((s, b) => s + b.itDeductionAmount, 0);
  const totalLCess = raBills.reduce((s, b) => s + b.lCessDeductionAmount, 0);
  const totalSD = raBills.reduce((s, b) => s + b.securityDepositAmount, 0);
  const totalRecover = raBills.reduce((s, b) => s + b.recoverFromRaBillAmount, 0);
  const totalGSTW = raBills.reduce((s, b) => s + b.gstWithheldAmount, 0);
  const totalWH = raBills.reduce((s, b) => s + b.withheldAmount, 0);
  const totalReceived = raBills.reduce((s, b) => s + b.totalReceivedAmount, 0);

  const summaryValues = [
    "", "", "", "", "TOTAL", "",
    money(totalBillAmt), money(totalTaxAmt), money(totalAmt), "", money(totalCheque),
    money(totalIT), money(totalLCess), money(totalSD), money(totalRecover),
    money(totalGSTW), money(totalWH), money(totalReceived), "", ""
  ];

  let sx = MARGIN_X;
  for (let c = 0; c < SCALED_WIDTHS.length; c++) {
    const w = SCALED_WIDTHS[c];
    cell(doc, sx, curY, w, ROW_H, summaryValues[c], {
      fontSize: 6.5,
      bold: true,
      fill: "#1e3a5f",
      textColor: "#ffffff",
      align: c === 4 ? "center" : c >= 6 && c <= 17 ? "right" : "left"
    });
    sx += w;
  }

  const safeProjectNumber = projectNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`RA-Bill-Log_${safeProjectNumber}.pdf`);
}
