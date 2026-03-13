import jsPDF from "jspdf";
import type { ProjectRequisitionFormItem } from "./domain";

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.rect(x, y, w, h);
}

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number, labelW: number, valueW: number, h = 9) {
  doc.text(label, x, y + 6);
  drawBox(doc, x + labelW, y, valueW, h);
  doc.text(value || "-", x + labelW + 2, y + 6);
}

function money(value: string) {
  return value || "0";
}

export function downloadProjectRequisitionPdf(form: ProjectRequisitionFormItem, projectName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("GEO DESIGNS & RESEARCH PVT. LTD.", pageW / 2, 12, { align: "center" });
  doc.setFontSize(11);
  doc.text("PROJECT NO. REQUISITION FORM", pageW / 2, 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`Application Date: ${new Date(form.applicationDate).toLocaleDateString("en-GB")}`, 232, 20);

  doc.setFont("helvetica", "bold");
  doc.text("COST CENTRE / DEPARTMENT", 10, 33);
  doc.text("NAME OF HOD/DIR", 92, 33);
  doc.text("HOD/DIR (SIGNATURE)", 175, 33);
  doc.setFont("helvetica", "normal");
  drawBox(doc, 10, 36, 58, 10);
  drawBox(doc, 82, 36, 58, 10);
  drawBox(doc, 174, 36, 58, 10);
  doc.text(form.costCentreDepartment, 39, 42, { align: "center" });
  doc.text(form.hodDirectorName, 111, 42, { align: "center" });

  drawLabelValue(doc, "Client Name:-", form.clientName, 10, 52, 40, 150);
  drawLabelValue(doc, "Billing Name:-", form.billingName, 10, 65, 40, 150);
  doc.text("Address with Pin Code", 10, 82);
  drawBox(doc, 50, 74, 120, 22);
  doc.text(doc.splitTextToSize(form.addressWithPincode, 115), 52, 80);
  doc.text("Pincode", 182, 82);
  drawBox(doc, 200, 74, 40, 10);
  doc.text(form.pincode, 202, 80);

  drawLabelValue(doc, "GST Tin Number", form.gstNumber, 10, 102, 40, 80);
  drawLabelValue(doc, "GST - REGISTER / UN REGISTER", form.gstType === "REGISTERED" ? "REGISTERED" : "UNREGISTERED", 140, 102, 50, 50);
  drawLabelValue(doc, "Contact Name:-", form.contactName, 10, 116, 40, 80);
  drawLabelValue(doc, "Contact No.", form.contactNumber, 140, 116, 30, 70);
  drawLabelValue(doc, "Designation:-", form.designation, 10, 129, 40, 80);
  drawLabelValue(doc, "Department:-", form.department, 140, 129, 30, 70);
  drawLabelValue(doc, "TAN No/ PAN No.:-", form.panTanNumber, 10, 142, 40, 80);
  drawLabelValue(doc, "Email ID:-", form.email, 140, 142, 30, 70);

  doc.addPage("a4", "landscape");
  drawLabelValue(doc, "Work Order / PO/LOI/LOA in Rs.", money(form.workOrderValue), 10, 10, 72, 70);
  drawLabelValue(doc, "WO/PO/LOI/LOA DATE", form.workOrderDate ? new Date(form.workOrderDate).toLocaleDateString("en-GB") : "-", 165, 10, 55, 40);
  drawLabelValue(doc, "Agreement No.", form.agreementNumber || "-", 10, 24, 72, 70);
  drawLabelValue(doc, "Agreement Date", form.agreementDate ? new Date(form.agreementDate).toLocaleDateString("en-GB") : "-", 165, 24, 55, 40);
  drawLabelValue(doc, "Amount of W.O./Agreement", money(form.amountOfWorkOrder), 10, 38, 72, 70);
  drawLabelValue(doc, "Project Starting Date", new Date(form.projectStartingDate).toLocaleDateString("en-GB"), 165, 38, 55, 40);
  drawLabelValue(doc, "GST Amount in Rs.", money(form.gstAmount), 10, 52, 72, 70);
  drawLabelValue(doc, "Project Duration (in Days)", `${form.projectDurationDays} Days`, 165, 52, 55, 40);
  drawLabelValue(doc, "WO/PO/LOI/LOA No.", form.workOrderNumber, 10, 72, 72, 70);
  drawLabelValue(doc, "Project Completion Date", new Date(form.projectCompletionDate).toLocaleDateString("en-GB"), 165, 72, 55, 40);
  drawLabelValue(doc, "New Project Number", form.newProjectNumber, 10, 90, 72, 70);

  doc.text("Name of Work:-", 10, 112);
  drawBox(doc, 82, 102, 170, 28);
  doc.text(doc.splitTextToSize(form.nameOfWork, 165), 84, 109);

  drawLabelValue(doc, "Location of Work - District:", form.locationDistrict, 10, 138, 72, 70);
  drawLabelValue(doc, "State :-", form.state, 170, 138, 30, 52);
  drawLabelValue(doc, "EMD", money(form.emdAmount), 10, 152, 72, 70);
  drawLabelValue(doc, "P.G./SD Amount", money(form.pgSdAmount), 10, 165, 72, 70);
  drawLabelValue(doc, "P.G. Date", form.pgDate ? new Date(form.pgDate).toLocaleDateString("en-GB") : "-", 10, 178, 72, 70);
  drawLabelValue(doc, "P.G. Expiry Date", form.pgExpiryDate ? new Date(form.pgExpiryDate).toLocaleDateString("en-GB") : "-", 10, 191, 72, 70);

  doc.addPage("a4", "landscape");
  doc.setFont("helvetica", "bold");
  doc.text("MANAGER ADMINISTRATION :", 30, 20);
  doc.text(form.approvedBy, 180, 20);
  doc.text("APPROVED PROJECT NO.", 180, 32);
  drawBox(doc, 220, 24, 50, 14);
  doc.text(form.approvedProjectNumber, 245, 33, { align: "center" });
  doc.text("CHECKED BY:", 40, 34);
  doc.text("APPROVED BY:", 180, 34);
  doc.setFont("helvetica", "normal");
  doc.text("Name & Signature :", 10, 66);
  doc.line(55, 66, 100, 66);
  doc.text("Signature:", 180, 66);
  doc.line(215, 66, 260, 66);

  doc.save(`${projectName.replace(/\s+/g, "-").toLowerCase()}-project-requisition-form.pdf`);
}
