import jsPDF from "jspdf";
import type { ProjectRequisitionFormItem } from "./domain";

const FIELD_LABEL_RATIO = 0.42;

const COMPANY_NAME_BY_CODE: Record<string, string> = {
  G: "GEO DESIGNS & RESEARCH PVT. LTD.",
  S: "SAI GEOTECHNICAL LAB",
  I: "INERTIA ENGINEERING SOLUTION",
  H: "SHREE HARI TESTING LAB"
};

function money(value: string | null | undefined) {
  return value && value.trim() ? value : "";
}

function fmtDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB");
}

function toDisplay(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text.length ? text : "";
}

function resolveCompanyTitle(form: ProjectRequisitionFormItem, projectNumber?: string) {
  const candidates = [projectNumber, form.approvedProjectNumber, form.newProjectNumber];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const code = candidate.trim().charAt(0).toUpperCase();
    if (COMPANY_NAME_BY_CODE[code]) {
      return COMPANY_NAME_BY_CODE[code];
    }
  }
  return COMPANY_NAME_BY_CODE.G;
}

function drawTextInBox(doc: jsPDF, text: string, x: number, y: number, w: number, h: number, opts?: { fontSize?: number; lineHeight?: number; align?: "left" | "center" | "right" }) {
  const fontSize = opts?.fontSize ?? 9;
  const lineHeight = opts?.lineHeight ?? 4.2;
  const align = opts?.align ?? "left";
  const usableW = Math.max(1, w - 1.8);
  const usableH = Math.max(1, h - 1.8);
  const maxLines = Math.max(1, Math.floor(usableH / lineHeight));
  const lines = doc.splitTextToSize(text, usableW) as string[];
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length > 0) {
    const last = visible.length - 1;
    const trimmed = visible[last].slice(0, Math.max(0, visible[last].length - 1));
    visible[last] = `${trimmed}...`;
  }

  doc.setFontSize(fontSize);
  if (align === "left") {
    doc.text(visible, x + 1, y + 1 + lineHeight);
  } else if (align === "center") {
    const centerX = x + w / 2;
    visible.forEach((line, idx) => {
      doc.text(line, centerX, y + 1 + lineHeight + idx * lineHeight, { align: "center" });
    });
  } else {
    const rightX = x + w - 1;
    visible.forEach((line, idx) => {
      doc.text(line, rightX, y + 1 + lineHeight + idx * lineHeight, { align: "right" });
    });
  }
}

function drawField(doc: jsPDF, args: { x: number; y: number; w: number; h: number; label: string; value: string; labelRatio?: number; valueAlign?: "left" | "center" | "right" }) {
  const { x, y, w, h, label, value, valueAlign = "left" } = args;
  const labelW = Math.max(30, Math.min(w * FIELD_LABEL_RATIO, w - 24));
  const valueW = w - labelW;
  doc.rect(x, y, w, h);
  doc.line(x + labelW, y, x + labelW, y + h);
  doc.setFont("times", "bold");
  drawTextInBox(doc, label, x, y, labelW, h, { fontSize: 8.6, lineHeight: 4.1 });
  doc.setFont("times", "normal");
  drawTextInBox(doc, value, x + labelW, y, valueW, h, { fontSize: 9.2, lineHeight: 4.2, align: valueAlign });
}

function countLines(doc: jsPDF, text: string, width: number) {
  const usableW = Math.max(1, width - 1.8);
  const lines = doc.splitTextToSize(text || "", usableW) as string[];
  return Math.max(1, lines.length);
}

function measureFieldHeight(
  doc: jsPDF,
  args: { w: number; label: string; value: string; labelRatio?: number; minH?: number }
) {
  const { w, label, value, minH = 8 } = args;
  const labelW = Math.max(30, Math.min(w * FIELD_LABEL_RATIO, w - 24));
  const valueW = w - labelW;

  const labelLines = countLines(doc, label, labelW);
  const valueLines = countLines(doc, value, valueW);

  const labelNeeded = labelLines * 4.1 + 2;
  const valueNeeded = valueLines * 4.2 + 2;
  return Math.max(minH, labelNeeded, valueNeeded);
}

type FieldLayout = {
  label: string;
  value: string;
  labelRatio?: number;
  valueAlign?: "left" | "center" | "right";
  minH?: number;
};

type LayoutRow =
  | { kind: "pair"; left: FieldLayout; right: FieldLayout }
  | { kind: "full"; field: FieldLayout };

export function downloadProjectRequisitionPdf(form: ProjectRequisitionFormItem, projectName: string, projectNumber?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const x = margin;
  const y = margin;
  const w = pageW - margin * 2;
  const h = pageH - margin * 2;

  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);

  const companyTitle = resolveCompanyTitle(form, projectNumber);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(companyTitle, x + w / 2, y + 5.5, { align: "center" });
  doc.setFontSize(10.5);
  doc.text("PROJECT NO. REQUISITION FORM", x + w / 2, y + 10.5, { align: "center" });

  drawField(doc, {
    x: x + w - 70,
    y: y + 3,
    w: 66,
    h: 8,
    label: "Application Date",
    value: fmtDate(form.applicationDate),
    valueAlign: "center"
  });

  const contentTop = y + 15;
  const footerH = 20;
  const footerY = y + h - footerH;

  const leftColW = (w - 4) / 2;
  const rightColX = x + leftColW + 4;
  const rows: LayoutRow[] = [
    {
      kind: "pair",
      left: { label: "Cost Centre / Department", value: toDisplay(form.costCentreDepartment), valueAlign: "center" },
      right: { label: "Name of HOD/DIR", value: toDisplay(form.hodDirectorName), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "Client Name", value: toDisplay(form.clientName) },
      right: { label: "Billing Name", value: toDisplay(form.billingName) }
    },
    {
      kind: "pair",
      left: { label: "Address with Pin Code", value: toDisplay(form.addressWithPincode), minH: 10 },
      right: { label: "Pincode", value: toDisplay(form.pincode), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "GST Type", value: form.gstType === "REGISTERED" ? "REGISTERED" : "UNREGISTERED", valueAlign: "center" },
      right: { label: "GST Tin Number", value: toDisplay(form.gstNumber) }
    },
    {
      kind: "pair",
      left: { label: "Contact No.", value: toDisplay(form.contactNumber) },
      right: { label: "Contact Name", value: toDisplay(form.contactName) }
    },
    {
      kind: "pair",
      left: { label: "Department", value: toDisplay(form.department) },
      right: { label: "Designation", value: toDisplay(form.designation) }
    },
    {
      kind: "pair",
      left: { label: "TAN / PAN No.", value: toDisplay(form.panTanNumber) },
      right: { label: "Email ID", value: toDisplay(form.email) }
    },
    {
      kind: "pair",
      left: { label: "Work Order / PO / LOI Value", value: money(form.workOrderValue) },
      right: { label: "WO/PO/LOI Date", value: fmtDate(form.workOrderDate), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "Amount of W.O./Agreement", value: money(form.amountOfWorkOrder) },
      right: { label: "Agreement Date", value: fmtDate(form.agreementDate), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "GST Amount", value: money(form.gstAmount) },
      right: { label: "Project Starting Date", value: fmtDate(form.projectStartingDate), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "WO/PO/LOI/LOA No.", value: toDisplay(form.workOrderNumber) },
      right: { label: "Project Duration", value: form.projectDurationDays ? `${form.projectDurationDays} Days` : "", valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "New Project Number", value: toDisplay(form.newProjectNumber) },
      right: { label: "Project Completion Date", value: fmtDate(form.projectCompletionDate), valueAlign: "center" }
    },
    {
      kind: "full",
      field: { label: "Name of Work", value: toDisplay(form.nameOfWork), minH: 14 }
    },
    {
      kind: "pair",
      left: { label: "Location of Work - District", value: toDisplay(form.locationDistrict) },
      right: { label: "State", value: toDisplay(form.state) }
    },
    {
      kind: "pair",
      left: { label: "EMD", value: money(form.emdAmount) },
      right: { label: "P.G./SD Amount", value: money(form.pgSdAmount) }
    },
    {
      kind: "pair",
      left: { label: "P.G. Date", value: fmtDate(form.pgDate), valueAlign: "center" },
      right: { label: "P.G. Expiry Date", value: fmtDate(form.pgExpiryDate), valueAlign: "center" }
    },
    {
      kind: "pair",
      left: { label: "Approved Project No.", value: toDisplay(form.approvedProjectNumber), valueAlign: "center" },
      right: { label: "Approved By", value: toDisplay(form.approvedBy) }
    }
  ];

  const baseHeights = rows.map((row) => {
    if (row.kind === "full") {
      return measureFieldHeight(doc, {
        w,
        label: row.field.label,
        value: row.field.value,
        labelRatio: row.field.labelRatio,
        minH: row.field.minH ?? 7
      });
    }

    const leftH = measureFieldHeight(doc, {
      w: leftColW,
      label: row.left.label,
      value: row.left.value,
      labelRatio: row.left.labelRatio,
      minH: row.left.minH ?? 7
    });
    const rightH = measureFieldHeight(doc, {
      w: leftColW,
      label: row.right.label,
      value: row.right.value,
      labelRatio: row.right.labelRatio,
      minH: row.right.minH ?? 7
    });
    return Math.max(leftH, rightH);
  });

  const availableContentH = footerY - contentTop;
  const baseTotalH = baseHeights.reduce((sum, item) => sum + item, 0);
  const extraPerRow = baseTotalH < availableContentH ? (availableContentH - baseTotalH) / rows.length : 0;

  let rowY = contentTop;
  rows.forEach((row, index) => {
    const rowH = baseHeights[index] + extraPerRow;

    if (row.kind === "full") {
      drawField(doc, {
        x,
        y: rowY,
        w,
        h: rowH,
        label: row.field.label,
        value: row.field.value,
        labelRatio: row.field.labelRatio,
        valueAlign: row.field.valueAlign
      });
    } else {
      drawField(doc, {
        x,
        y: rowY,
        w: leftColW,
        h: rowH,
        label: row.left.label,
        value: row.left.value,
        labelRatio: row.left.labelRatio,
        valueAlign: row.left.valueAlign
      });
      drawField(doc, {
        x: rightColX,
        y: rowY,
        w: leftColW,
        h: rowH,
        label: row.right.label,
        value: row.right.value,
        labelRatio: row.right.labelRatio,
        valueAlign: row.right.valueAlign
      });
    }

    rowY += rowH;
  });

  doc.rect(x, footerY, w, 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("MANAGER ADMINISTRATION", x + 28, footerY + 4.5);
  doc.text("CHECKED BY", x + 32, footerY + 11);
  doc.text("APPROVED BY", x + w - 56, footerY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Name & Signature:", x + 4, footerY + 18);
  doc.line(x + 34, footerY + 18, x + 72, footerY + 18);
  doc.text("Signature:", x + w - 72, footerY + 18);
  doc.line(x + w - 40, footerY + 18, x + w - 6, footerY + 18);

  doc.save(`${projectName.replace(/\s+/g, "-").toLowerCase()}-project-requisition-form.pdf`);
}
