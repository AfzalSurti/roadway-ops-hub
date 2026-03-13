import jsPDF from "jspdf";
import type { ProjectRequisitionFormItem } from "./domain";

function money(value: string | null | undefined) {
  return value && value.trim() ? value : "0";
}

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

function toDisplay(value?: string | number | null) {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text.length ? text : "-";
}

function drawTextInBox(doc: jsPDF, text: string, x: number, y: number, w: number, h: number, opts?: { fontSize?: number; lineHeight?: number; align?: "left" | "center" | "right" }) {
  const fontSize = opts?.fontSize ?? 7.8;
  const lineHeight = opts?.lineHeight ?? 3.6;
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
  const { x, y, w, h, label, value, labelRatio = 0.36, valueAlign = "left" } = args;
  const labelW = Math.max(24, Math.min(w * labelRatio, w - 20));
  const valueW = w - labelW;
  doc.rect(x, y, w, h);
  doc.line(x + labelW, y, x + labelW, y + h);
  doc.setFont("times", "bold");
  drawTextInBox(doc, label, x, y, labelW, h, { fontSize: 7.2, lineHeight: 3.4 });
  doc.setFont("times", "normal");
  drawTextInBox(doc, value, x + labelW, y, valueW, h, { fontSize: 7.6, lineHeight: 3.6, align: valueAlign });
}

export function downloadProjectRequisitionPdf(form: ProjectRequisitionFormItem, projectName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 4;
  const contentW = pageW - margin * 2;

  doc.setLineWidth(0.35);
  doc.rect(margin, margin, contentW, pageH - margin * 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("GEO DESIGNS & RESEARCH PVT. LTD.", margin + contentW / 2, 9, { align: "center" });
  doc.setFontSize(14);
  doc.text("PROJECT NO. REQUISITION FORM", margin + contentW / 2, 14.5, { align: "center" });

  drawField(doc, {
    x: margin + contentW - 72,
    y: 5,
    w: 68,
    h: 10,
    label: "Application Date",
    value: fmtDate(form.applicationDate),
    labelRatio: 0.55,
    valueAlign: "center"
  });

  const x = margin + 2;
  let y = 20;
  const totalW = contentW - 4;
  const leftW = 178;
  const rightW = totalW - leftW;
  const rowH = 10;

  drawField(doc, { x, y, w: 86, h: rowH, label: "Cost Centre / Department", value: toDisplay(form.costCentreDepartment), labelRatio: 0.54, valueAlign: "center" });
  drawField(doc, { x: x + 86, y, w: 52, h: rowH, label: "Name of HOD / DIR", value: toDisplay(form.hodDirectorName), labelRatio: 0.54, valueAlign: "center" });
  drawField(doc, { x: x + 138, y, w: 40, h: rowH, label: "HOD / DIR (Signature)", value: "", labelRatio: 1 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Approved Project No.", value: toDisplay(form.approvedProjectNumber), labelRatio: 0.58, valueAlign: "center" });

  y += rowH;
  drawField(doc, { x, y, w: leftW, h: rowH, label: "Client Name", value: toDisplay(form.clientName), labelRatio: 0.24 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "GST Type", value: form.gstType === "REGISTERED" ? "REGISTERED" : "UNREGISTERED", labelRatio: 0.42, valueAlign: "center" });

  y += rowH;
  drawField(doc, { x, y, w: leftW, h: rowH, label: "Billing Name", value: toDisplay(form.billingName), labelRatio: 0.24 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "GST Number", value: toDisplay(form.gstNumber), labelRatio: 0.42 });

  y += rowH;
  drawField(doc, { x, y, w: leftW - 42, h: rowH * 2, label: "Address with Pin Code", value: toDisplay(form.addressWithPincode), labelRatio: 0.28 });
  drawField(doc, { x: x + leftW - 42, y, w: 42, h: rowH * 2, label: "Pincode", value: toDisplay(form.pincode), labelRatio: 0.44, valueAlign: "center" });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Contact Name", value: toDisplay(form.contactName), labelRatio: 0.42 });

  y += rowH;
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Contact No.", value: toDisplay(form.contactNumber), labelRatio: 0.42 });

  y += rowH;
  drawField(doc, { x, y, w: leftW / 2, h: rowH, label: "Designation", value: toDisplay(form.designation), labelRatio: 0.42 });
  drawField(doc, { x: x + leftW / 2, y, w: leftW / 2, h: rowH, label: "Department", value: toDisplay(form.department), labelRatio: 0.42 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Email ID", value: toDisplay(form.email), labelRatio: 0.42 });

  y += rowH;
  drawField(doc, { x, y, w: leftW / 2, h: rowH, label: "PAN / TAN No.", value: toDisplay(form.panTanNumber), labelRatio: 0.42 });
  drawField(doc, { x: x + leftW / 2, y, w: leftW / 2, h: rowH, label: "Work Order / PO / LOI Value", value: money(form.workOrderValue), labelRatio: 0.62 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "WO / PO / LOI Date", value: fmtDate(form.workOrderDate), labelRatio: 0.58, valueAlign: "center" });

  y += rowH;
  drawField(doc, { x, y, w: leftW / 2, h: rowH, label: "Agreement No.", value: toDisplay(form.agreementNumber), labelRatio: 0.42 });
  drawField(doc, { x: x + leftW / 2, y, w: leftW / 2, h: rowH, label: "Agreement Date", value: fmtDate(form.agreementDate), labelRatio: 0.42, valueAlign: "center" });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "WO / PO / LOI No.", value: toDisplay(form.workOrderNumber), labelRatio: 0.58 });

  y += rowH;
  drawField(doc, { x, y, w: leftW / 2, h: rowH, label: "Amount of WO/Agreement", value: money(form.amountOfWorkOrder), labelRatio: 0.56 });
  drawField(doc, { x: x + leftW / 2, y, w: leftW / 2, h: rowH, label: "GST Amount", value: money(form.gstAmount), labelRatio: 0.42 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "New Project Number", value: toDisplay(form.newProjectNumber), labelRatio: 0.58, valueAlign: "center" });

  y += rowH;
  drawField(doc, { x, y, w: leftW / 2, h: rowH, label: "Project Start Date", value: fmtDate(form.projectStartingDate), labelRatio: 0.48, valueAlign: "center" });
  drawField(doc, { x: x + leftW / 2, y, w: leftW / 2, h: rowH, label: "Project Duration", value: `${toDisplay(form.projectDurationDays)} Days`, labelRatio: 0.45, valueAlign: "center" });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Project Completion Date", value: fmtDate(form.projectCompletionDate), labelRatio: 0.58, valueAlign: "center" });

  y += rowH;
  drawField(doc, { x, y, w: leftW, h: 26, label: "Name of Work", value: toDisplay(form.nameOfWork), labelRatio: 0.18 });
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Location (District)", value: toDisplay(form.locationDistrict), labelRatio: 0.58 });

  y += rowH;
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "State", value: toDisplay(form.state), labelRatio: 0.58 });

  y += rowH;
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "Approved By", value: toDisplay(form.approvedBy), labelRatio: 0.58 });

  y += rowH;
  const amtY = y;
  drawField(doc, { x: x + leftW, y: amtY, w: rightW, h: rowH, label: "EMD", value: money(form.emdAmount), labelRatio: 0.58 });

  y += rowH;
  drawField(doc, { x: x + leftW, y, w: rightW, h: rowH, label: "P.G. / S.D. Amount", value: money(form.pgSdAmount), labelRatio: 0.58 });

  y += rowH;
  drawField(doc, { x: x + leftW, y, w: rightW / 2, h: rowH, label: "P.G. Date", value: fmtDate(form.pgDate), labelRatio: 0.54, valueAlign: "center" });
  drawField(doc, { x: x + leftW + rightW / 2, y, w: rightW / 2, h: rowH, label: "P.G. Expiry Date", value: fmtDate(form.pgExpiryDate), labelRatio: 0.58, valueAlign: "center" });

  const footerY = 194;
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text("MANAGER ADMINISTRATION", x + 34, footerY);
  doc.text("CHECKED BY", x + 36, footerY + 7);
  doc.text("APPROVED BY", x + leftW + rightW - 42, footerY + 7);

  doc.setFont("times", "normal");
  doc.setFontSize(7.6);
  doc.text("Name & Signature:", x + 2, 204);
  doc.line(x + 34, 204, x + 88, 204);
  doc.text("Signature:", x + leftW + rightW - 64, 204);
  doc.line(x + leftW + rightW - 40, 204, x + leftW + rightW - 2, 204);

  doc.save(`${projectName.replace(/\s+/g, "-").toLowerCase()}-project-requisition-form.pdf`);
}
