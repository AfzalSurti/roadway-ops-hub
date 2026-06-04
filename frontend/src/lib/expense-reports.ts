import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ExpenseCategoryItem, ExpenseSheetItem, ExpenseVoucherItem } from "./domain";

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
];

function fmtDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoney(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function amountInWordsIndian(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Zero";
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

function buildSummaryRows(sheet: ExpenseSheetItem) {
  const byDate = new Map<string, Record<string, number>>();
  for (const entry of sheet.entries) {
    const dateKey = fmtDate(entry.entryDate);
    const row = byDate.get(dateKey) ?? Object.fromEntries(SUMMARY_CATEGORY_ORDER.map((name) => [name, 0]));
    const categoryName = entry.category?.name ?? "";
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
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("GEO DESIGNS & RESEARCH (P) LTD. - SITE EXPENSE SHEET", 14, 14);
  doc.setFontSize(9);
  doc.text(`Employee: ${sheet.employeeName ?? ""} | Site: ${sheet.siteName} | Incharge: ${sheet.siteIncharge}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["Date", ...SUMMARY_CATEGORY_ORDER.map((c) => c.slice(0, 12)), "Total"]],
    body: [
      ...rows.map((row) => [
        row.date,
        ...SUMMARY_CATEGORY_ORDER.map((cat) => fmtMoney(row.amounts[cat] ?? 0)),
        fmtMoney(row.total)
      ]),
      ["Total", ...SUMMARY_CATEGORY_ORDER.map((cat) => fmtMoney(columnTotals[cat] ?? 0)), fmtMoney(grandTotal)]
    ],
    styles: { fontSize: 6 },
    headStyles: { fillColor: [220, 220, 220], textColor: 20 }
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 180;
  doc.text(`Total Advance: ${fmtMoney(totalAdvance)} | Total Expenses: ${fmtMoney(grandTotal)} | Due: ${fmtMoney(totalAdvance - grandTotal)}`, 14, finalY + 8);
  doc.text(`Amount in words: ${amountInWordsIndian(grandTotal)}`, 14, finalY + 14);
  doc.save(`site-expense-summary-${sheet.id}.pdf`);
}

export function downloadDetailedExpenseSheetExcel(sheet: ExpenseSheetItem) {
  const rows = sheet.entries.map((entry, index) => ({
    "Sr No": index + 1,
    Date: fmtDate(entry.entryDate),
    Category: entry.category?.name ?? "",
    Description: entry.description,
    Amount: entry.amount,
    "Bill Available": entry.billAvailable ? "Yes" : "No",
    "Bill Number": entry.billNumber ?? ""
  }));
  const total = sheet.entries.reduce((sum, e) => sum + e.amount, 0);
  rows.push({ "Sr No": "", Date: "", Category: "", Description: "Total", Amount: total, "Bill Available": "", "Bill Number": "" });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed");
  XLSX.writeFile(workbook, `detailed-expense-${sheet.id}.xlsx`);
}

export function downloadDetailedExpenseSheetPdf(sheet: ExpenseSheetItem) {
  const doc = new jsPDF();
  doc.setFontSize(13);
  doc.text("Detailed Expense Sheet", 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [["Sr", "Date", "Category", "Description", "Amount", "Bill?", "Bill No"]],
    body: [
      ...sheet.entries.map((entry, index) => [
        String(index + 1),
        fmtDate(entry.entryDate),
        entry.category?.name ?? "",
        entry.description,
        fmtMoney(entry.amount),
        entry.billAvailable ? "Yes" : "No",
        entry.billNumber ?? "-"
      ]),
      ["", "", "", "Total", fmtMoney(sheet.entries.reduce((s, e) => s + e.amount, 0)), "", ""]
    ],
    styles: { fontSize: 8 }
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

export function downloadVoucherReportPdf(vouchers: ExpenseVoucherItem[], meta: { projectNumber?: string | null; projectName?: string }) {
  const doc = new jsPDF();
  const total = vouchers.reduce((sum, v) => sum + v.amount, 0);
  const grouped = new Map<string, ExpenseVoucherItem[]>();
  for (const voucher of vouchers) {
    const key = fmtDate(voucher.date);
    const list = grouped.get(key) ?? [];
    list.push(voucher);
    grouped.set(key, list);
  }

  let y = 14;
  let voucherIndex = 0;
  for (const [date, items] of grouped.entries()) {
    if (y > 250) {
      doc.addPage();
      y = 14;
    }
    voucherIndex += 1;
    doc.setFontSize(11);
    doc.text("GEO DESIGNS & RESEARCH (P) LTD.", 14, y);
    doc.setFontSize(9);
    doc.text("B-10 Krishna Industrial Estate, Gorwa Estate, Vadodara - 390016", 14, y + 5);
    doc.text(`Proj no / Site: ${meta.projectNumber ?? ""} (${meta.projectName ?? ""})`, 14, y + 10);
    doc.text(`Cash Voucher no: ${voucherIndex}`, 150, y + 10);
    doc.text(`Date: ${fmtDate(new Date().toISOString())}`, 150, y + 15);

    autoTable(doc, {
      startY: y + 20,
      head: [["Date", "Particulars", "Amount (Rs.)"]],
      body: items.map((item) => [date, item.description, fmtMoney(item.amount)]),
      foot: [["Total", amountInWordsIndian(items.reduce((s, i) => s + i.amount, 0)), fmtMoney(items.reduce((s, i) => s + i.amount, 0))]],
      styles: { fontSize: 8 }
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 16;
  }

  doc.text(`Total Voucher Amount: Rs. ${fmtMoney(total)}`, 14, Math.min(y, 280));
  doc.save(`voucher-report-${meta.projectNumber ?? "all"}.pdf`);
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
