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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const x = 16;
  const y = 12;
  const w = 265;
  const h = 186;

  doc.setLineWidth(0.28);
  doc.rect(x, y, w, h);

  // Header block
  doc.rect(x, y, w, 8);
  doc.rect(x, y + 8, w, 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("GEO DESIGNS & RESEARCH PVT. LTD.", x + w / 2, y + 5.2, { align: "center" });
  doc.setFontSize(7.5);
  doc.text("PROJECT NO. REQUISITION FORM", x + w / 2, y + 12.7, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Application Date:", x + w - 75, y + 11.5);
  doc.rect(x + w - 28, y + 8.4, 24, 6);
  doc.setFont("helvetica", "normal");
  drawTextInBox(doc, fmtDate(form.applicationDate), x + w - 28, y + 8.4, 24, 6, { fontSize: 7, lineHeight: 3.2, align: "center" });

  // Top identity labels and boxes
  const startY = y + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.7);
  doc.text("COST CENTRE / DEPARTMENT", x + 1, startY - 0.8);
  doc.text("CCH", x + 86, startY - 0.8);
  doc.text("NAME OF HOD/DIR", x + 112, startY - 0.8);
  doc.text("CCH", x + 184, startY - 0.8);
  doc.text("HOD/DIR  (SIGNATURE)", x + 202, startY - 0.8);

  doc.rect(x, startY, 58, 7);
  doc.rect(x + 72, startY, 34, 7);
  doc.rect(x + 118, startY, 34, 7);
  doc.rect(x + 160, startY, 34, 7);
  doc.rect(x + 194, startY, 71, 7);
  doc.setFont("helvetica", "normal");
  drawTextInBox(doc, toDisplay(form.costCentreDepartment), x, startY, 58, 7, { fontSize: 7, lineHeight: 3.2, align: "center" });
  drawTextInBox(doc, toDisplay(form.hodDirectorName), x + 118, startY, 34, 7, { fontSize: 7, lineHeight: 3.2, align: "center" });

  let rowY = startY + 10;
  const leftLabelW = 70;
  const leftFieldW = 168;
  const rightLabelW = 26;
  const rightFieldW = 55;
  const rowH = 7.6;

  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW, h: rowH, label: "Client Name:-", value: toDisplay(form.clientName), labelRatio: leftLabelW / (leftLabelW + leftFieldW) });
  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW, h: rowH, label: "Billing Name:-", value: toDisplay(form.billingName), labelRatio: leftLabelW / (leftLabelW + leftFieldW) });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW - 32, h: rowH * 2, label: "Address with Pin Code", value: toDisplay(form.addressWithPincode), labelRatio: leftLabelW / (leftLabelW + leftFieldW - 32) });
  drawField(doc, { x: x + leftLabelW + leftFieldW - 32, y: rowY, w: 32, h: rowH * 2, label: "Pincode", value: toDisplay(form.pincode), labelRatio: 0.48, valueAlign: "center" });

  rowY += rowH * 2 + 2;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "GST Tin Number", value: toDisplay(form.gstNumber), labelRatio: 0.38 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "GST - REGISTER / UN REGISTER", value: form.gstType === "REGISTERED" ? "" : "", labelRatio: 1 });

  rowY += rowH + 2;
  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW - 40, h: rowH, label: "Contact Name:-", value: toDisplay(form.contactName), labelRatio: leftLabelW / (leftLabelW + leftFieldW - 40) });
  drawField(doc, { x: x + leftLabelW + leftFieldW - 32, y: rowY, w: rightLabelW + rightFieldW, h: rowH, label: "Contact No.", value: toDisplay(form.contactNumber), labelRatio: rightLabelW / (rightLabelW + rightFieldW) });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW - 40, h: rowH, label: "Designation:-", value: toDisplay(form.designation), labelRatio: leftLabelW / (leftLabelW + leftFieldW - 40) });
  drawField(doc, { x: x + leftLabelW + leftFieldW - 32, y: rowY, w: rightLabelW + rightFieldW, h: rowH, label: "Department:-", value: toDisplay(form.department), labelRatio: rightLabelW / (rightLabelW + rightFieldW) });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: leftLabelW + leftFieldW - 40, h: rowH, label: "TAN NO / PAN No.:-", value: toDisplay(form.panTanNumber), labelRatio: leftLabelW / (leftLabelW + leftFieldW - 40) });
  drawField(doc, { x: x + leftLabelW + leftFieldW - 32, y: rowY, w: rightLabelW + rightFieldW, h: rowH, label: "Email ID:-", value: toDisplay(form.email), labelRatio: rightLabelW / (rightLabelW + rightFieldW) });

  rowY += rowH + 1;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "Work Order / PO/LOI/LOA in Rs.", value: money(form.workOrderValue), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "WO/PO/LOI/LOA DATE", value: fmtDate(form.workOrderDate), labelRatio: 0.72, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "Agreement No.", value: toDisplay(form.agreementNumber), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "Agreement Date", value: fmtDate(form.agreementDate), labelRatio: 0.72, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "Amount of W.O./Agreement", value: money(form.amountOfWorkOrder), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "Project Starting Date", value: fmtDate(form.projectStartingDate), labelRatio: 0.72, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "GST Amount in Rs. (incl./NA/18%)", value: money(form.gstAmount), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "Project Duration (in Days)", value: form.projectDurationDays ? `${form.projectDurationDays} Days` : "", labelRatio: 0.72, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH * 1.35, label: "WO/PO/LOI/LOA No.", value: toDisplay(form.workOrderNumber), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH * 1.35, label: "Project Completion Date", value: fmtDate(form.projectCompletionDate), labelRatio: 0.72, valueAlign: "center" });

  rowY += rowH * 1.35 + 1;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "New Project Number", value: toDisplay(form.newProjectNumber), labelRatio: 0.5 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 265, h: 20, label: "Name of Work:-", value: toDisplay(form.nameOfWork), labelRatio: 0.2 });

  rowY += 22;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "Location of Work - District:", value: toDisplay(form.locationDistrict), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH, label: "State :-", value: toDisplay(form.state), labelRatio: 0.4 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "EMD", value: money(form.emdAmount), labelRatio: 0.5 });
  drawField(doc, { x: x + 170, y: rowY, w: 95, h: rowH * 2, label: "APPROVED\nPROJECT NO.", value: toDisplay(form.approvedProjectNumber), labelRatio: 0.56, valueAlign: "center" });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "P.G./SD Amount", value: money(form.pgSdAmount), labelRatio: 0.5 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "P.G. Date", value: fmtDate(form.pgDate), labelRatio: 0.5 });

  rowY += rowH;
  drawField(doc, { x, y: rowY, w: 160, h: rowH, label: "P.G. Expiry Date", value: fmtDate(form.pgExpiryDate), labelRatio: 0.5 });

  const adminY = 178;
  doc.rect(x, adminY, 265, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("MANAGER ADMINISTRATION :", x + 26, adminY + 4.1);
  doc.text(toDisplay(form.approvedBy), x + 164, adminY + 4.1);
  doc.rect(x, adminY + 6, 265, 6);
  doc.text("CHECKED BY:", x + 40, adminY + 10.1);
  doc.text("APPROVED BY:", x + 165, adminY + 10.1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Name  & Signature :", x + 6, adminY + 18);
  doc.line(x + 52, adminY + 18, x + 94, adminY + 18);
  doc.text("Signature:", x + 156, adminY + 18);
  doc.line(x + 190, adminY + 18, x + 232, adminY + 18);

  doc.save(`${projectName.replace(/\s+/g, "-").toLowerCase()}-project-requisition-form.pdf`);
}
