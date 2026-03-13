import jsPDF from "jspdf";
import type { ProjectRequisitionFormItem } from "./domain";

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GEO DESIGNS & RESEARCH PVT. LTD.", x + w / 2, y + 5.5, { align: "center" });
  doc.setFontSize(8.5);
  doc.text("PROJECT NO. REQUISITION FORM", x + w / 2, y + 10.5, { align: "center" });

  drawField(doc, {
    x: x + w - 70,
    y: y + 3,
    w: 66,
    h: 8,
    label: "Application Date",
    value: fmtDate(form.applicationDate),
    labelRatio: 0.56,
    valueAlign: "center"
  });

  let rowY = y + 15;
  const rowH = 7;
  const leftColW = (w - 4) / 2;
  const rightColX = x + leftColW + 4;

  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Cost Centre / Department", value: toDisplay(form.costCentreDepartment), labelRatio: 0.52, valueAlign: "center" });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Name of HOD/DIR", value: toDisplay(form.hodDirectorName), labelRatio: 0.5, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Client Name", value: toDisplay(form.clientName), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Billing Name", value: toDisplay(form.billingName), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH * 2, label: "Address with Pin Code", value: toDisplay(form.addressWithPincode), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Pincode", value: toDisplay(form.pincode), labelRatio: 0.4, valueAlign: "center" });
  drawField(doc, { x: rightColX, y: rowY + rowH, w: leftColW, h: rowH, label: "GST Tin Number", value: toDisplay(form.gstNumber), labelRatio: 0.4 });

  rowY += rowH * 2;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "GST Type", value: form.gstType === "REGISTERED" ? "REGISTERED" : "UNREGISTERED", labelRatio: 0.4, valueAlign: "center" });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Contact Name", value: toDisplay(form.contactName), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Contact No.", value: toDisplay(form.contactNumber), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Designation", value: toDisplay(form.designation), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Department", value: toDisplay(form.department), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Email ID", value: toDisplay(form.email), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "TAN / PAN No.", value: toDisplay(form.panTanNumber), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Agreement No.", value: toDisplay(form.agreementNumber), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Work Order / PO / LOI Value", value: money(form.workOrderValue), labelRatio: 0.52 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "WO/PO/LOI Date", value: fmtDate(form.workOrderDate), labelRatio: 0.52, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Amount of W.O./Agreement", value: money(form.amountOfWorkOrder), labelRatio: 0.52 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Agreement Date", value: fmtDate(form.agreementDate), labelRatio: 0.52, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "GST Amount", value: money(form.gstAmount), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Project Starting Date", value: fmtDate(form.projectStartingDate), labelRatio: 0.52, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "WO/PO/LOI/LOA No.", value: toDisplay(form.workOrderNumber), labelRatio: 0.52 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Project Duration", value: form.projectDurationDays ? `${form.projectDurationDays} Days` : "", labelRatio: 0.52, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "New Project Number", value: toDisplay(form.newProjectNumber), labelRatio: 0.52 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Project Completion Date", value: fmtDate(form.projectCompletionDate), labelRatio: 0.52, valueAlign: "center" });

  rowY += rowH + 1;
  drawField(doc, { x, y: rowY, w, h: 18, label: "Name of Work", value: toDisplay(form.nameOfWork), labelRatio: 0.2 });

  rowY += 19;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Location of Work - District", value: toDisplay(form.locationDistrict), labelRatio: 0.52 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "State", value: toDisplay(form.state), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "EMD", value: money(form.emdAmount), labelRatio: 0.4 });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "P.G./SD Amount", value: money(form.pgSdAmount), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "P.G. Date", value: fmtDate(form.pgDate), labelRatio: 0.4, valueAlign: "center" });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "P.G. Expiry Date", value: fmtDate(form.pgExpiryDate), labelRatio: 0.45, valueAlign: "center" });

  rowY += rowH + 1;
  drawField(doc, { x, y: rowY, w: leftColW, h: rowH, label: "Approved Project No.", value: toDisplay(form.approvedProjectNumber), labelRatio: 0.52, valueAlign: "center" });
  drawField(doc, { x: rightColX, y: rowY, w: leftColW, h: rowH, label: "Approved By", value: toDisplay(form.approvedBy), labelRatio: 0.4 });

  const footerY = y + h - 20;
  doc.rect(x, footerY, w, 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("MANAGER ADMINISTRATION", x + 28, footerY + 4.5);
  doc.text("CHECKED BY", x + 32, footerY + 11);
  doc.text("APPROVED BY", x + w - 56, footerY + 11);

  doc.setFont("helvetica", "normal");
  doc.text("Name & Signature:", x + 4, footerY + 18);
  doc.line(x + 34, footerY + 18, x + 72, footerY + 18);
  doc.text("Signature:", x + w - 72, footerY + 18);
  doc.line(x + w - 40, footerY + 18, x + w - 6, footerY + 18);

  doc.save(`${projectName.replace(/\s+/g, "-").toLowerCase()}-project-requisition-form.pdf`);
}
