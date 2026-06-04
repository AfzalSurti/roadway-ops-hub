import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RowInput } from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ExpenseSheetItem, ExpenseVoucherItem } from "./domain";

const COMPANY_NAME = "GEO DESIGNS RESEARCH (P) LTD.";
const COMPANY_NAME_VOUCHER = "GEO DESIGNS & RESEARCH (P) LTD.";
const COMPANY_ADDRESS =
  "B-10 Krishna Industrial Estate, Gorwa Estate, Vadodara - 390016. www.geogroup.in / email: info@geogroup.in";
const EXPENSE_NOTE = "Note: For any clarifications regarding filling up this form, please call +91 99625 29200.";

const SUMMARY_CATEGORY_ORDER = [
  "Advance from Office",
  "Advance Given to Staff",
  "Printing & Stationery",
  "Site / Office / GH / Misc. Expense",
  "Food",
  "Hotel Rent",
  "Fuel / Petrol / Diesel / CNG",
  "Vehicle Repairs & Maintenance",
  "Travel / Auto / Bus / Train / Air"
] as const;

const SUMMARY_COLUMN_HEADERS = [
  "Date",
  "Adv from Office",
  "Adv Given to Staff",
  "Printing & Stationary",
  "Site / Office / GH / Misc. Exp",
  "Food",
  "Hotel Rent",
  "Fuel / Petrol / Diesel / CNG",
  "Vehicle Repairs & Maintenance",
  "Travel / Auto / Bus / Train / Air",
  "Total Rs."
] as const;

const SIGNATURE_LABELS = ["Employee's Sign", "Team Leader", "Check By", "Approved by", "Accounts Officer"] as const;
const VOUCHER_SIGNATURE_LABELS = ["Prepared by", "Accountant", "Manager", "Receiver"] as const;

const MIN_SUMMARY_DATA_ROWS = 16;
const MIN_DETAILED_DATA_ROWS = 28;

function fmtDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(value: number, blankIfZero = false) {
  if (blankIfZero && (!value || value === 0)) return "";
  return value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMoneyRs(value: number) {
  return `₹ ${fmtMoney(value)}`;
}

function financialYearLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Expense format FY- 2024-25";
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `Expense format FY- ${startYear}-${String(endYear).slice(-2)}`;
}

function amountInWordsIndian(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Zero Rupees";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (num: number) => {
    if (num < 20) return ones[num];
    return `${tens[Math.floor(num / 10)]}${ones[num % 10] ? ` ${ones[num % 10]}` : ""}`.trim();
  };
  const three = (num: number) => {
    if (num < 100) return two(num);
    return `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${two(num % 100)}` : ""}`.trim();
  };
  let words = "";
  let num = Math.round(n);
  if (num >= 100000) {
    words += `${three(Math.floor(num / 100000))} Lakh `;
    num %= 100000;
  }
  if (num >= 1000) {
    words += `${three(Math.floor(num / 1000))} Thousand `;
    num %= 1000;
  }
  if (num > 0) words += three(num);
  return `${words.trim()} Rupees`;
}

function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: { bold?: boolean; align?: "left" | "center" | "right"; fontSize?: number; fill?: boolean }
) {
  if (opts?.fill) {
    doc.setFillColor(245, 245, 245);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(opts?.fontSize ?? 8);
  doc.setTextColor(0);
  const pad = 1.2;
  const lines = doc.splitTextToSize(text, Math.max(4, w - pad * 2)) as string[];
  const lineH = (opts?.fontSize ?? 8) * 0.38;
  const blockH = lines.length * lineH;
  let textY = y + Math.max(pad + lineH, (h - blockH) / 2 + lineH);
  const align = opts?.align ?? "left";
  for (const line of lines) {
    if (align === "center") doc.text(line, x + w / 2, textY, { align: "center" });
    else if (align === "right") doc.text(line, x + w - pad, textY, { align: "right" });
    else doc.text(line, x + pad, textY);
    textY += lineH;
  }
}

function drawLabelValueRow(
  doc: jsPDF,
  x: number,
  y: number,
  totalW: number,
  rowH: number,
  left: { label: string; value: string },
  right: { label: string; value: string }
) {
  const half = totalW / 2;
  const labelW = 42;
  drawCell(doc, x, y, labelW, rowH, left.label, { bold: true });
  drawCell(doc, x + labelW, y, half - labelW, rowH, left.value);
  drawCell(doc, x + half, y, labelW, rowH, right.label, { bold: true });
  drawCell(doc, x + half + labelW, y, half - labelW, rowH, right.value);
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function normalizeCategoryKey(name: string) {
  const trimmed = name.trim();
  if (trimmed === "Printing & Stationary") return "Printing & Stationery";
  if (trimmed === "Site / Office / GH / Misc. Exp") return "Site / Office / GH / Misc. Expense";
  return trimmed;
}

function buildSummaryRows(sheet: ExpenseSheetItem) {
  const byDate = new Map<string, Record<string, number>>();
  for (const entry of sheet.entries) {
    const dateKey = fmtDate(entry.entryDate);
    const row = byDate.get(dateKey) ?? Object.fromEntries(SUMMARY_CATEGORY_ORDER.map((name) => [name, 0]));
    const categoryName = normalizeCategoryKey(entry.category?.name ?? "");
    if (categoryName in row) row[categoryName] += entry.amount;
    byDate.set(dateKey, row);
  }

  const rows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amounts]) => {
      const total = SUMMARY_CATEGORY_ORDER.reduce((sum, cat) => sum + (amounts[cat] ?? 0), 0);
      return { date, amounts, total };
    });

  const columnTotals = Object.fromEntries(SUMMARY_CATEGORY_ORDER.map((name) => [name, 0]));
  let grandTotal = 0;
  for (const row of rows) {
    grandTotal += row.total;
    for (const name of SUMMARY_CATEGORY_ORDER) {
      columnTotals[name] += row.amounts[name] ?? 0;
    }
  }

  const totalAdvance =
    (columnTotals["Advance from Office"] ?? 0) + (columnTotals["Advance Given to Staff"] ?? 0);

  return { rows, columnTotals, grandTotal, totalAdvance };
}

function groupEntriesByDate(sheet: ExpenseSheetItem) {
  const groups = new Map<string, typeof sheet.entries>();
  const sorted = [...sheet.entries].sort(
    (a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
  );
  for (const entry of sorted) {
    const key = fmtDate(entry.entryDate);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function voucherDisplayNumber(voucherNumber: string) {
  const parts = voucherNumber.split("-");
  const last = parts[parts.length - 1];
  return String(Number.parseInt(last, 10) || voucherNumber);
}

export function downloadSummaryExpenseSheetExcel(sheet: ExpenseSheetItem) {
  const { rows, columnTotals, grandTotal, totalAdvance } = buildSummaryRows(sheet);
  const headerRows = [
    ["SITE EXPENSE SHEET"],
    ["Full Name of Employee", sheet.employeeName ?? sheet.employee?.name ?? "", "Bank Account", sheet.bankAccount ?? ""],
    ["Total Persons at Site", String(sheet.totalPersons), "Sheet no", sheet.sheetNumber ?? ""],
    ["Name of Work Site", sheet.siteName, "Project Code", sheet.projectNumber ?? ""],
    ["Name of Site Incharge", sheet.siteIncharge, "Mobile no", sheet.mobileNumber ?? sheet.employee?.contactNumber ?? ""],
    [],
    ["Date", ...SUMMARY_CATEGORY_ORDER, "Total Rs."]
  ];

  for (const row of rows) {
    headerRows.push([
      row.date,
      ...SUMMARY_CATEGORY_ORDER.map((cat) => row.amounts[cat] || ""),
      row.total
    ] as Array<string | number>);
  }

  headerRows.push([
    "Total (Rs.)",
    ...SUMMARY_CATEGORY_ORDER.map((cat) => columnTotals[cat] || 0),
    grandTotal
  ] as Array<string | number>);
  headerRows.push([]);
  headerRows.push(["Total Advance", totalAdvance]);
  headerRows.push(["Total Expenses", grandTotal]);
  headerRows.push(["Due / Advance Amount", totalAdvance - grandTotal]);
  headerRows.push(["Amount in Rupees", amountInWordsIndian(grandTotal)]);

  const worksheet = XLSX.utils.aoa_to_sheet(headerRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
  XLSX.writeFile(workbook, `site-expense-summary-${sheet.id}.xlsx`);
}

export function downloadSummaryExpenseSheetPdf(sheet: ExpenseSheetItem) {
  const { rows, columnTotals, grandTotal, totalAdvance } = buildSummaryRows(sheet);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 8;
  const tableW = pageW - marginX * 2;
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(COMPANY_NAME, pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(13);
  doc.text("SITE EXPENSE SHEET", pageW / 2, y, { align: "center" });
  const titleW = doc.getTextWidth("SITE EXPENSE SHEET");
  doc.setLineWidth(0.4);
  doc.line(pageW / 2 - titleW / 2, y + 1.2, pageW / 2 + titleW / 2, y + 1.2);
  y += 6;

  const headerH = 7;
  const employeeName = sheet.employeeName ?? sheet.employee?.name ?? "";
  const personsLabel = sheet.totalPersons === 1 ? "1 person" : `${sheet.totalPersons} persons`;
  drawLabelValueRow(doc, marginX, y, tableW, headerH, { label: "Full Name of Employee:", value: employeeName }, { label: "Bank Account:", value: sheet.bankAccount ?? "" });
  y += headerH;
  drawLabelValueRow(doc, marginX, y, tableW, headerH, { label: "Total Persons at Site:", value: personsLabel }, { label: "Sheet no:", value: sheet.sheetNumber != null ? String(sheet.sheetNumber) : "" });
  y += headerH;
  drawLabelValueRow(doc, marginX, y, tableW, headerH, { label: "Name of Work Site:", value: sheet.siteName }, { label: "Project Code:", value: sheet.projectNumber ?? "" });
  y += headerH;
  drawLabelValueRow(doc, marginX, y, tableW, headerH, { label: "Name of Site Incharge:", value: sheet.siteIncharge }, { label: "Mobile no:", value: sheet.mobileNumber ?? sheet.employee?.contactNumber ?? "" });
  y += headerH + 1;

  const dataRows: RowInput[] = rows.map((row) => [
    row.date,
    ...SUMMARY_CATEGORY_ORDER.map((cat) => fmtMoney(row.amounts[cat] ?? 0, true)),
    fmtMoney(row.total)
  ]);
  while (dataRows.length < MIN_SUMMARY_DATA_ROWS) {
    dataRows.push(["", ...SUMMARY_CATEGORY_ORDER.map(() => ""), ""]);
  }
  dataRows.push([
    "Total (Rs.)",
    ...SUMMARY_CATEGORY_ORDER.map((cat) => fmtMoney(columnTotals[cat] ?? 0, true)),
    fmtMoney(grandTotal)
  ]);

  const colWidths: Record<number, { cellWidth: number }> = {
    0: { cellWidth: 18 },
    10: { cellWidth: 16 }
  };

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: tableW,
    head: [SUMMARY_COLUMN_HEADERS as unknown as string[]],
    body: dataRows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: "center",
      valign: "middle",
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 6.2,
      halign: "center"
    },
    columnStyles: colWidths,
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === dataRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  y = lastTableY(doc, y + 40) + 3;
  const footerTop = y;
  const leftW = tableW * 0.34;
  const rightW = tableW - leftW;
  const boxH = 7;

  drawCell(doc, marginX, footerTop, leftW * 0.55, boxH, "Total Advance", { bold: true });
  drawCell(doc, marginX + leftW * 0.55, footerTop, leftW * 0.45, boxH, fmtMoney(totalAdvance, true), { align: "right" });
  drawCell(doc, marginX, footerTop + boxH, leftW * 0.55, boxH, "Total Expenses", { bold: true });
  drawCell(doc, marginX + leftW * 0.55, footerTop + boxH, leftW * 0.45, boxH, fmtMoney(grandTotal), { align: "right" });
  drawCell(doc, marginX, footerTop + boxH * 2, leftW * 0.55, boxH, "Due / Advance Amount", { bold: true });
  drawCell(doc, marginX + leftW * 0.55, footerTop + boxH * 2, leftW * 0.45, boxH, fmtMoney(totalAdvance - grandTotal), { align: "right" });

  drawCell(doc, marginX + leftW, footerTop, 28, boxH * 3, "Amount in Rupees", { bold: true, align: "center" });
  drawCell(doc, marginX + leftW + 28, footerTop, rightW - 28, boxH * 3, amountInWordsIndian(grandTotal), { align: "center" });

  y = footerTop + boxH * 3 + 2;
  const sigW = tableW / SIGNATURE_LABELS.length;
  const sigH = 16;
  for (let i = 0; i < SIGNATURE_LABELS.length; i += 1) {
    drawCell(doc, marginX + sigW * i, y, sigW, sigH, SIGNATURE_LABELS[i], { bold: true, align: "center", fontSize: 7 });
  }

  y += sigH + 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(EXPENSE_NOTE, marginX, y);
  doc.text(financialYearLabel(sheet.expenseDate), marginX, doc.internal.pageSize.getHeight() - 6);

  doc.save(`site-expense-summary-${sheet.id}.pdf`);
}

export function downloadDetailedExpenseSheetExcel(sheet: ExpenseSheetItem) {
  const body: Array<Array<string | number>> = [["Sr", "Date", "Detail Description of Expense", "Bill No.", "Amount", "Total"]];
  let sr = 1;
  for (const [date, entries] of groupEntriesByDate(sheet)) {
    const groupTotal = entries.reduce((sum, e) => sum + e.amount, 0);
    entries.forEach((entry, idx) => {
      body.push([
        idx === 0 ? sr : "",
        idx === 0 ? date : "",
        entry.description,
        entry.billNumber ?? "",
        entry.amount,
        idx === 0 ? groupTotal : ""
      ]);
    });
    sr += 1;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(body);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed");
  XLSX.writeFile(workbook, `detailed-expense-${sheet.id}.xlsx`);
}

export function downloadDetailedExpenseSheetPdf(sheet: ExpenseSheetItem) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 10;
  const tableW = doc.internal.pageSize.getWidth() - marginX * 2;
  const body: RowInput[] = [];
  let sr = 1;

  for (const [date, entries] of groupEntriesByDate(sheet)) {
    const groupTotal = entries.reduce((sum, e) => sum + e.amount, 0);
    const span = entries.length;
    entries.forEach((entry, idx) => {
      if (idx === 0) {
        body.push([
          { content: String(sr), rowSpan: span, styles: { valign: "middle", halign: "center", fontStyle: "bold" } },
          { content: date, rowSpan: span, styles: { valign: "middle", halign: "center" } },
          entry.description,
          entry.billNumber ?? "",
          { content: fmtMoney(entry.amount), styles: { halign: "right" } },
          { content: fmtMoney(groupTotal), rowSpan: span, styles: { valign: "middle", halign: "center", fontStyle: "bold" } }
        ]);
      } else {
        body.push([
          entry.description,
          entry.billNumber ?? "",
          { content: fmtMoney(entry.amount), styles: { halign: "right" } }
        ]);
      }
    });
    sr += 1;
  }

  while (body.length < MIN_DETAILED_DATA_ROWS) {
    body.push(["", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: 12,
    margin: { left: marginX, right: marginX },
    tableWidth: tableW,
    head: [["Sr", "Date", "Detail Description of Expense", "Bill No.", "Amount", "Total"]],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      halign: "center",
      valign: "middle",
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center"
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: tableW - 10 - 22 - 24 - 24 - 24, halign: "left" },
      3: { cellWidth: 24 },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24 }
    }
  });

  doc.save(`detailed-expense-${sheet.id}.pdf`);
}

export function downloadVoucherReportExcel(vouchers: ExpenseVoucherItem[], sheetLabel: string) {
  const rows = vouchers.map((v) => ({
    "Voucher Number": v.voucherNumber,
    Date: fmtDate(v.date),
    "Employee Name": v.employeeName,
    "Project Name": v.projectName,
    "Expense Category": v.expenseCategory,
    Description: v.description,
    Amount: v.amount,
    Status: v.approvalStatus
  }));
  const total = vouchers.reduce((sum, v) => sum + v.amount, 0);
  rows.push({
    "Voucher Number": "",
    Date: "",
    "Employee Name": "",
    "Project Name": "Total Voucher Amount",
    "Expense Category": "",
    Description: "",
    Amount: total,
    Status: ""
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");
  XLSX.writeFile(workbook, `voucher-report-${sheetLabel}.xlsx`);
}

function drawVoucherPage(
  doc: jsPDF,
  items: ExpenseVoucherItem[],
  meta: { projectNumber?: string | null; projectName?: string },
  pageIndex: number
) {
  if (pageIndex > 0) doc.addPage();
  const marginX = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = pageW - marginX * 2;
  let y = 14;
  const first = items[0];
  const voucherNo = voucherDisplayNumber(first.voucherNumber);
  const voucherDate = fmtDate(first.date);
  const siteLine = [meta.projectNumber, meta.projectName].filter(Boolean).join("/") || first.projectName;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY_NAME_VOUCHER, marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(COMPANY_ADDRESS, marginX, y);
  y += 8;

  const metaH = 8;
  const leftW = tableW * 0.68;
  const rightW = tableW - leftW;
  const rightCol = rightW / 2;
  drawCell(doc, marginX, y, 34, metaH, "Proj no / Site", { bold: true });
  drawCell(doc, marginX + 34, y, leftW - 34, metaH, siteLine);
  drawCell(doc, marginX + leftW, y, rightCol, metaH, "Cash Voucher no", { bold: true });
  drawCell(doc, marginX + leftW + rightCol, y, rightCol, metaH, voucherNo, { align: "center" });
  drawCell(doc, marginX, y + metaH, 34, metaH, "Debit / Credit", { bold: true });
  drawCell(doc, marginX + 34, y + metaH, leftW - 34, metaH, "");
  drawCell(doc, marginX + leftW, y + metaH, rightCol, metaH, "Date", { bold: true });
  drawCell(doc, marginX + leftW + rightCol, y + metaH, rightCol, metaH, voucherDate, { align: "center" });
  y += metaH * 2 + 2;

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const tableBody: RowInput[] = items.map((item, idx) => [
    idx === 0 ? fmtDate(item.date) : "",
    item.description,
    fmtMoneyRs(item.amount)
  ]);
  const emptyRows = Math.max(0, 8 - tableBody.length);
  for (let i = 0; i < emptyRows; i += 1) tableBody.push(["", "", ""]);

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: tableW,
    head: [["Date", "Particulars", "Amount (₹)"]],
    body: tableBody,
    foot: [["Total", amountInWordsIndian(total), fmtMoneyRs(total)]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0]
    },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" },
      1: { cellWidth: tableW - 26 - 34, halign: "left" },
      2: { cellWidth: 34, halign: "right" }
    },
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index === 1) {
        data.cell.styles.halign = "center";
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  y = lastTableY(doc, y + 60) + 10;
  const sigW = tableW / VOUCHER_SIGNATURE_LABELS.length;
  const sigH = 18;
  for (let i = 0; i < VOUCHER_SIGNATURE_LABELS.length; i += 1) {
    drawCell(doc, marginX + sigW * i, y, sigW, sigH, VOUCHER_SIGNATURE_LABELS[i], { bold: true, align: "center", fontSize: 8 });
  }
}

export function downloadVoucherReportPdf(
  vouchers: ExpenseVoucherItem[],
  meta: { projectNumber?: string | null; projectName?: string }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (vouchers.length === 0) return;

  const grouped = new Map<string, ExpenseVoucherItem[]>();
  for (const voucher of vouchers) {
    const key = voucher.voucherNumber;
    const list = grouped.get(key) ?? [];
    list.push(voucher);
    grouped.set(key, list);
  }

  let pageIndex = 0;
  for (const items of grouped.values()) {
    drawVoucherPage(doc, items, meta, pageIndex);
    pageIndex += 1;
  }

  doc.save(`voucher-report-${meta.projectNumber ?? "sheet"}.pdf`);
}

export function getSheetVouchers(sheet: ExpenseSheetItem): ExpenseVoucherItem[] {
  return sheet.entries
    .filter((entry) => !entry.billAvailable && entry.voucher)
    .map((entry) => ({
      id: entry.voucher!.id,
      voucherNumber: entry.voucher!.voucherNumber,
      generatedAt: entry.voucher!.generatedAt,
      date: entry.entryDate,
      employeeName: sheet.employeeName ?? sheet.employee?.name ?? "",
      projectName: sheet.projectName ?? sheet.siteName,
      projectNumber: sheet.projectNumber,
      expenseCategory: entry.category?.name ?? "",
      description: entry.description,
      amount: entry.amount,
      approvalStatus: sheet.status
    }));
}
