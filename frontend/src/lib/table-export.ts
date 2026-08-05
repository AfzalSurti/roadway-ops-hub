import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type TableExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function cellText(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function stamp() {
  return new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeFilename(name: string) {
  return name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_");
}

/** Download filtered table rows as Excel (.xlsx). */
export function downloadTableExcel<T>(options: {
  filename: string;
  sheetName?: string;
  title?: string;
  columns: TableExportColumn<T>[];
  rows: T[];
}) {
  const { filename, sheetName = "Export", title, columns, rows } = options;
  const header = columns.map((c) => c.header);
  const body = rows.map((row) => columns.map((c) => cellText(c.value(row))));
  const aoa: (string | number)[][] = [];
  if (title) {
    aoa.push([title]);
    aoa.push([`Generated: ${stamp()}`]);
    aoa.push([`Rows: ${rows.length}`]);
    aoa.push([]);
  }
  aoa.push(header, ...body);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${safeFilename(filename)}.xlsx`);
}

/** Download filtered table rows as PDF. */
export function downloadTablePdf<T>(options: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: TableExportColumn<T>[];
  rows: T[];
  landscape?: boolean;
}) {
  const { filename, title, subtitle, columns, rows, landscape } = options;
  const doc = new jsPDF({
    orientation: landscape || columns.length > 8 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  doc.setFontSize(13);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Generated: ${stamp()}  ·  Rows: ${rows.length}${subtitle ? `  ·  ${subtitle}` : ""}`, 14, 20);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 24,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cellText(c.value(row)))),
    styles: { fontSize: columns.length > 10 ? 6.5 : 8, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    theme: "grid",
    margin: { left: 10, right: 10 },
  });

  doc.save(`${safeFilename(filename)}.pdf`);
}
