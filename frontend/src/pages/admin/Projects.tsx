import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { BarChart3, Download, FileText, Hash, Pencil, Plus, Search, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { downloadProjectRequisitionPdf } from "@/lib/project-requisition-pdf";
import { downloadProjectReport } from "@/lib/reports-pdf";
import { isTaskOverdue, statusConfig, type ProjectRequisitionFormItem } from "@/lib/domain";
import { PROJECT_PLAN_TEMPLATE } from "@/lib/project-plan-template";

type WizardStep = 1 | 2 | 3 | 4 | 5;
type RequisitionStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type ProjectPlanEntry = {
  id: string;
  activityCode: string;
  activityName: string;
  subActivityCode: string;
  subActivityName: string;
  startDate: string;
  days: string;
  endDate: string;
};

type ProjectPlanStoreItem = {
  generatedAt: string;
  entries: ProjectPlanEntry[];
};

type ProjectPlansStore = Record<string, ProjectPlanStoreItem>;

const PROJECT_PLAN_STORAGE_KEY = "roadway.ops.projectPlans.v1";

type NumberWizardState = {
  projectId: string;
  companyCode: "G" | "S" | "I" | "H" | "";
  technicalUnitCode: "T" | "S" | "D" | "";
  subTechnicalUnitCode: string;
  workCategoryCode: string;
  baseCode: string;
};

type RequisitionFormDraft = {
  costCentreDepartment: string;
  hodDirectorName: string;
  applicationDate: string;
  clientName: string;
  billingName: string;
  addressWithPincode: string;
  pincode: string;
  gstNumber: string;
  gstType: "REGISTERED" | "UNREGISTERED";
  contactName: string;
  contactNumber: string;
  designation: string;
  department: string;
  panTanNumber: string;
  email: string;
  workOrderValue: string;
  workOrderDate: string;
  agreementNumber: string;
  agreementDate: string;
  projectStartingDate: string;
  projectDurationDays: string;
  projectCompletionDate: string;
  workOrderNumber: string;
  newProjectNumber: string;
  amountOfWorkOrder: string;
  gstAmount: string;
  emdAmount: string;
  pgSdAmount: string;
  pgDate: string;
  pgExpiryDate: string;
  nameOfWork: string;
  locationDistrict: string;
  state: string;
  approvedProjectNumber: string;
  approvedBy: string;
};

const FALLBACK_COMPANIES = [
  { label: "Geo Designs & Research Pvt. Ltd", code: "G" },
  { label: "Sai Geotechnical Lab", code: "S" },
  { label: "Inertia Engineering Solution", code: "I" },
  { label: "Shree Hari Testing Lab", code: "H" }
];

const FALLBACK_TECHNICAL_UNITS = [
  { label: "Testing Consultancy", code: "T" },
  { label: "Supervision Consultancy", code: "S" },
  { label: "Building Designs Consultancy", code: "D" }
];

const FALLBACK_SUB_TECHNICAL_UNITS: Record<string, Array<{ label: string; code: string }>> = {
  T: [
    { label: "Geotechnical Exploration", code: "GE" },
    { label: "Laboratory Testing", code: "MT" },
    { label: "Load Testing Services (Bridge/Pile)", code: "LT" },
    { label: "Chemical Environment Testing", code: "CE" },
    { label: "NDT", code: "ND" }
  ],
  S: [
    { label: "Authority Engineer", code: "AE" },
    { label: "Independent Engineer", code: "IE" },
    { label: "Project Management Consultant", code: "PM" },
    { label: "Third Party Inspection", code: "TP" },
    { label: "Proof Checking", code: "PC" },
    { label: "Field Highway Testing", code: "FH" },
    { label: "Road Safety Audit", code: "RS" },
    { label: "Environment Audit", code: "EA" },
    { label: "Road Infrastructure Designs", code: "IR" },
    { label: "Bridge Infrastructure Designs", code: "IB" },
    { label: "Industrial Infrastructure & Park", code: "IS" },
    { label: "Marine Infrastructure", code: "MS" },
    { label: "Detail Design Infrastructure", code: "DD" },
    { label: "Hydro Engineering", code: "HE" },
    { label: "Tunnel Engineering", code: "TE" }
  ],
  D: [
    { label: "Architectural Design", code: "AR" },
    { label: "Structural Design", code: "ST" },
    { label: "BIM Services", code: "BM" },
    { label: "Utilities Design Services", code: "UD" },
    { label: "Quantity Survey & Estimation", code: "QS" },
    { label: "Energy Audit Services", code: "EN" },
    { label: "Green Building Services", code: "GB" },
    { label: "Building Infrastructure Designs", code: "BU" }
  ]
};

const FALLBACK_FH_WORK_CATEGORIES = [
  { label: "NSV Test", code: "N" },
  { label: "FWD Test", code: "F" },
  { label: "BBD Test", code: "B" },
  { label: "Roughness Index (BI/IRI) Test", code: "I" },
  { label: "Pavement Design", code: "P" },
  { label: "Retro Reflectometer Test", code: "R" },
  { label: "Topography / LiDAR Survey", code: "S" },
  { label: "Traffic Survey (Incl. ATCC / TMC / Videography / Axel load etc.)", code: "T" },
  { label: "Bridge Load Test", code: "L" },
  { label: "Mobile Bridge Inspection Unit", code: "M" }
];

const FALLBACK_DEFAULT_WORK_CATEGORIES = [
  { label: "Road", code: "R" },
  { label: "Building", code: "B" },
  { label: "Canal", code: "C" },
  { label: "Irrigation", code: "I" },
  { label: "Bridge", code: "G" },
  { label: "Pre Bid", code: "P" },
  { label: "Drainage", code: "D" }
];

const DEFAULT_WIZARD: NumberWizardState = {
  projectId: "",
  companyCode: "",
  technicalUnitCode: "",
  subTechnicalUnitCode: "",
  workCategoryCode: "",
  baseCode: ""
};

const DEFAULT_REQUISITION_DRAFT: RequisitionFormDraft = {
  costCentreDepartment: "",
  hodDirectorName: "",
  applicationDate: new Date().toISOString().slice(0, 10),
  clientName: "",
  billingName: "",
  addressWithPincode: "",
  pincode: "",
  gstNumber: "",
  gstType: "REGISTERED",
  contactName: "",
  contactNumber: "",
  designation: "",
  department: "",
  panTanNumber: "",
  email: "",
  workOrderValue: "",
  workOrderDate: "",
  agreementNumber: "",
  agreementDate: "",
  projectStartingDate: "",
  projectDurationDays: "",
  projectCompletionDate: "",
  workOrderNumber: "",
  newProjectNumber: "",
  amountOfWorkOrder: "",
  gstAmount: "",
  emdAmount: "0.00",
  pgSdAmount: "0.00",
  pgDate: "",
  pgExpiryDate: "",
  nameOfWork: "",
  locationDistrict: "",
  state: "",
  approvedProjectNumber: "",
  approvedBy: ""
};

function getFinancialYearShort(referenceDate = new Date()): number {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 3 ? year % 100 : (year - 1) % 100;
}

function addDays(dateText: string, daysText: string) {
  if (!dateText || !daysText) return "";
  const days = Number(daysText);
  if (!Number.isFinite(days) || days <= 0) return "";
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculatePlanEndDate(startDate: string, daysText: string) {
  if (!startDate || !daysText) return "";
  const days = Number(daysText);
  if (!Number.isFinite(days) || days <= 0) return "";
  const endDate = new Date(`${startDate}T00:00:00`);
  endDate.setDate(endDate.getDate() + days - 1);
  return endDate.toISOString().slice(0, 10);
}

function createDefaultProjectPlanEntries() {
  const rows: ProjectPlanEntry[] = [];
  PROJECT_PLAN_TEMPLATE.forEach((activity) => {
    activity.subActivities.forEach((subActivity, index) => {
      rows.push({
        id: `${activity.code}-${index + 1}`,
        activityCode: activity.code,
        activityName: activity.name,
        subActivityCode: `${activity.code}.${index + 1}`,
        subActivityName: subActivity,
        startDate: "",
        days: "",
        endDate: ""
      });
    });
  });
  return rows;
}

function parseProjectPlansStore(raw: string | null): ProjectPlansStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ProjectPlansStore;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function toPayload(draft: RequisitionFormDraft) {
  return {
    ...draft,
    projectDurationDays: Number(draft.projectDurationDays),
    workOrderDate: draft.workOrderDate || undefined,
    agreementNumber: draft.agreementNumber || undefined,
    agreementDate: draft.agreementDate || undefined,
    pgDate: draft.pgDate || undefined,
    pgExpiryDate: draft.pgExpiryDate || undefined
  };
}

function fromFormItem(item: ProjectRequisitionFormItem): RequisitionFormDraft {
  return {
    costCentreDepartment: item.costCentreDepartment,
    hodDirectorName: item.hodDirectorName,
    applicationDate: item.applicationDate.slice(0, 10),
    clientName: item.clientName,
    billingName: item.billingName,
    addressWithPincode: item.addressWithPincode,
    pincode: item.pincode,
    gstNumber: item.gstNumber,
    gstType: item.gstType,
    contactName: item.contactName,
    contactNumber: item.contactNumber,
    designation: item.designation,
    department: item.department,
    panTanNumber: item.panTanNumber,
    email: item.email,
    workOrderValue: item.workOrderValue,
    workOrderDate: item.workOrderDate?.slice(0, 10) ?? "",
    agreementNumber: item.agreementNumber ?? "",
    agreementDate: item.agreementDate?.slice(0, 10) ?? "",
    projectStartingDate: item.projectStartingDate.slice(0, 10),
    projectDurationDays: String(item.projectDurationDays),
    projectCompletionDate: item.projectCompletionDate.slice(0, 10),
    workOrderNumber: item.workOrderNumber,
    newProjectNumber: item.newProjectNumber,
    amountOfWorkOrder: item.amountOfWorkOrder,
    gstAmount: item.gstAmount,
    emdAmount: item.emdAmount,
    pgSdAmount: item.pgSdAmount,
    pgDate: item.pgDate?.slice(0, 10) ?? "",
    pgExpiryDate: item.pgExpiryDate?.slice(0, 10) ?? "",
    nameOfWork: item.nameOfWork,
    locationDistrict: item.locationDistrict,
    state: item.state,
    approvedProjectNumber: item.approvedProjectNumber,
    approvedBy: item.approvedBy
  };
}

function validateRequisitionStep(step: RequisitionStep, draft: RequisitionFormDraft) {
  if (step === 1 && (!draft.costCentreDepartment.trim() || !draft.hodDirectorName.trim() || !draft.applicationDate)) {
    return "Please complete all department information";
  }
  if (step === 2) {
    if (!draft.clientName.trim() || !draft.billingName.trim() || !draft.addressWithPincode.trim()) return "Please complete client information";
    if (!/^\d{6}$/.test(draft.pincode)) return "Pincode must be 6 digits";
    if (draft.gstNumber.trim().length !== 15) return "GST number must be 15 characters";
  }
  if (step === 3) {
    if (!draft.contactName.trim() || !draft.designation.trim() || !draft.department.trim()) return "Please complete contact information";
    if (!/^\d{10}$/.test(draft.contactNumber)) return "Contact number must be 10 digits";
    if (draft.panTanNumber.trim().length !== 10) return "PAN/TAN number must be 10 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) return "Please enter a valid email";
  }
  if (step === 4 && (!draft.workOrderValue.trim() || !draft.workOrderDate)) {
    return "Please complete work order details";
  }
  if (step === 5 && (!draft.projectStartingDate || !draft.projectDurationDays || !draft.projectCompletionDate || !draft.workOrderNumber.trim() || !draft.newProjectNumber.trim())) {
    return "Please complete project details";
  }
  if (step === 6 && (!draft.amountOfWorkOrder.trim() || !draft.gstAmount.trim() || !draft.emdAmount.trim() || !draft.pgSdAmount.trim())) {
    return "Please complete financial details";
  }
  if (step === 7 && (!draft.nameOfWork.trim() || !draft.locationDistrict.trim() || !draft.state.trim())) {
    return "Please complete work description";
  }
  if (step === 8 && (!draft.approvedProjectNumber.trim() || !draft.approvedBy.trim())) {
    return "Please complete approval information";
  }
  return null;
}

function StepField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function ProjectRequisitionStepContent({
  step,
  draft,
  setDraft
}: {
  step: RequisitionStep;
  draft: RequisitionFormDraft;
  setDraft: Dispatch<SetStateAction<RequisitionFormDraft>>;
}) {
  switch (step) {
    case 1:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Cost Centre / Department"><input value={draft.costCentreDepartment} onChange={(e) => setDraft((p) => ({ ...p, costCentreDepartment: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Cost Centre / Department" /></StepField>
          <StepField label="Name of HOD / Director"><input value={draft.hodDirectorName} onChange={(e) => setDraft((p) => ({ ...p, hodDirectorName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Name of HOD / Director" /></StepField>
          <StepField label="Application Date"><input type="date" value={draft.applicationDate} onChange={(e) => setDraft((p) => ({ ...p, applicationDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Application Date" /></StepField>
        </div>
      );
    case 2:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Client Name"><input value={draft.clientName} onChange={(e) => setDraft((p) => ({ ...p, clientName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Client Name" /></StepField>
          <StepField label="Billing Name"><input value={draft.billingName} onChange={(e) => setDraft((p) => ({ ...p, billingName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Billing Name" /></StepField>
          <StepField label="Address with Pincode"><textarea value={draft.addressWithPincode} onChange={(e) => setDraft((p) => ({ ...p, addressWithPincode: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 resize-none" title="Address with Pincode" /></StepField>
          <StepField label="Pincode"><input value={draft.pincode} onChange={(e) => setDraft((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Pincode" /></StepField>
          <StepField label="GST Number"><input value={draft.gstNumber} onChange={(e) => setDraft((p) => ({ ...p, gstNumber: e.target.value.toUpperCase().slice(0, 15) }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="GST Number" /></StepField>
          <StepField label="GST Type"><select value={draft.gstType} onChange={(e) => setDraft((p) => ({ ...p, gstType: e.target.value as RequisitionFormDraft["gstType"] }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="GST Type"><option value="REGISTERED">Registered</option><option value="UNREGISTERED">Unregistered</option></select></StepField>
        </div>
      );
    case 3:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Contact Name"><input value={draft.contactName} onChange={(e) => setDraft((p) => ({ ...p, contactName: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Contact Name" /></StepField>
          <StepField label="Contact Number"><input value={draft.contactNumber} onChange={(e) => setDraft((p) => ({ ...p, contactNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Contact Number" /></StepField>
          <StepField label="Designation"><input value={draft.designation} onChange={(e) => setDraft((p) => ({ ...p, designation: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Designation" /></StepField>
          <StepField label="Department"><input value={draft.department} onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Department" /></StepField>
          <StepField label="PAN/TAN Number"><input value={draft.panTanNumber} onChange={(e) => setDraft((p) => ({ ...p, panTanNumber: e.target.value.toUpperCase().slice(0, 10) }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="PAN/TAN Number" /></StepField>
          <StepField label="Email ID"><input value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Email ID" /></StepField>
        </div>
      );
    case 4:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Work Order / PO / LOI / LOA Value"><input value={draft.workOrderValue} onChange={(e) => setDraft((p) => ({ ...p, workOrderValue: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Work Order / PO / LOI / LOA Value" /></StepField>
          <StepField label="WO/PO/LOI/LOA Date"><input type="date" value={draft.workOrderDate} onChange={(e) => setDraft((p) => ({ ...p, workOrderDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="WO/PO/LOI/LOA Date" /></StepField>
          <StepField label="Agreement Number"><input value={draft.agreementNumber} onChange={(e) => setDraft((p) => ({ ...p, agreementNumber: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Agreement Number" /></StepField>
          <StepField label="Agreement Date"><input type="date" value={draft.agreementDate} onChange={(e) => setDraft((p) => ({ ...p, agreementDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Agreement Date" /></StepField>
        </div>
      );
    case 5:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Project Starting Date"><input type="date" value={draft.projectStartingDate} onChange={(e) => setDraft((p) => ({ ...p, projectStartingDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Project Starting Date" /></StepField>
          <StepField label="Project Duration (days)"><input value={draft.projectDurationDays} onChange={(e) => setDraft((p) => ({ ...p, projectDurationDays: e.target.value.replace(/\D/g, "") }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Project Duration (days)" /></StepField>
          <StepField label="Project Completion Date"><input type="date" value={draft.projectCompletionDate} onChange={(e) => setDraft((p) => ({ ...p, projectCompletionDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Project Completion Date" /></StepField>
          <StepField label="Work Order Number"><input value={draft.workOrderNumber} onChange={(e) => setDraft((p) => ({ ...p, workOrderNumber: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Work Order Number" /></StepField>
          <StepField label="New Project Number"><input value={draft.newProjectNumber} onChange={(e) => setDraft((p) => ({ ...p, newProjectNumber: e.target.value.toUpperCase() }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="New Project Number" /></StepField>
        </div>
      );
    case 6:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Amount of Work Order"><input value={draft.amountOfWorkOrder} onChange={(e) => setDraft((p) => ({ ...p, amountOfWorkOrder: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Amount of Work Order" /></StepField>
          <StepField label="GST Amount"><input value={draft.gstAmount} onChange={(e) => setDraft((p) => ({ ...p, gstAmount: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="GST Amount" /></StepField>
          <StepField label="EMD Amount"><input value={draft.emdAmount} onChange={(e) => setDraft((p) => ({ ...p, emdAmount: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="EMD Amount" /></StepField>
          <StepField label="PG / SD Amount"><input value={draft.pgSdAmount} onChange={(e) => setDraft((p) => ({ ...p, pgSdAmount: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="PG / SD Amount" /></StepField>
          <StepField label="PG Date"><input type="date" value={draft.pgDate} onChange={(e) => setDraft((p) => ({ ...p, pgDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="PG Date" /></StepField>
          <StepField label="PG Expiry Date"><input type="date" value={draft.pgExpiryDate} onChange={(e) => setDraft((p) => ({ ...p, pgExpiryDate: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="PG Expiry Date" /></StepField>
        </div>
      );
    case 7:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Name of Work"><textarea value={draft.nameOfWork} onChange={(e) => setDraft((p) => ({ ...p, nameOfWork: e.target.value }))} rows={5} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 resize-none" title="Name of Work" /></StepField>
          <div className="space-y-4">
            <StepField label="Location of Work (District)"><input value={draft.locationDistrict} onChange={(e) => setDraft((p) => ({ ...p, locationDistrict: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Location of Work (District)" /></StepField>
            <StepField label="State"><input value={draft.state} onChange={(e) => setDraft((p) => ({ ...p, state: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="State" /></StepField>
          </div>
        </div>
      );
    case 8:
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StepField label="Approved Project Number"><input value={draft.approvedProjectNumber} onChange={(e) => setDraft((p) => ({ ...p, approvedProjectNumber: e.target.value.toUpperCase() }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Approved Project Number" /></StepField>
          <StepField label="Approved By"><input value={draft.approvedBy} onChange={(e) => setDraft((p) => ({ ...p, approvedBy: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50" title="Approved By" /></StepField>
        </div>
      );
  }
}

export default function AdminProjects() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showNumberWizard, setShowNumberWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizard, setWizard] = useState<NumberWizardState>(DEFAULT_WIZARD);
  const [assigningNumber, setAssigningNumber] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", projectNumber: "" });
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditingSelectedProject, setIsEditingSelectedProject] = useState(false);
  const [savingSelectedProject, setSavingSelectedProject] = useState(false);
  const [selectedProjectForm, setSelectedProjectForm] = useState({ name: "", description: "", projectNumber: "" });
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [generatedProjectNumber, setGeneratedProjectNumber] = useState("");
  const [generatedProjectName, setGeneratedProjectName] = useState("");
  const [showRequisitionWizard, setShowRequisitionWizard] = useState(false);
  const [requisitionProjectId, setRequisitionProjectId] = useState<string | null>(null);
  const [requisitionDraft, setRequisitionDraft] = useState<RequisitionFormDraft>(DEFAULT_REQUISITION_DRAFT);
  const [savingRequisition, setSavingRequisition] = useState(false);
  const [projectPlans, setProjectPlans] = useState<ProjectPlansStore>({});
  const [planEditorProjectId, setPlanEditorProjectId] = useState<string | null>(null);
  const [planEditorEntries, setPlanEditorEntries] = useState<ProjectPlanEntry[]>([]);
  const [planChartProjectId, setPlanChartProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setProjectPlans(parseProjectPlansStore(window.localStorage.getItem(PROJECT_PLAN_STORAGE_KEY)));
  }, []);

  const persistProjectPlans = (next: ProjectPlansStore) => {
    setProjectPlans(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROJECT_PLAN_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", "projects-summary"],
    queryFn: () => api.getTasks({ limit: 500 })
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getProjects()
  });

  const { data: requisitionForms = [], refetch: refetchRequisitionForms } = useQuery({
    queryKey: ["project-requisition-forms"],
    queryFn: () => api.getProjectRequisitionForms()
  });

  const { data: numberingOptions } = useQuery({
    queryKey: ["project-numbering-options"],
    queryFn: () => api.getProjectNumberingOptions()
  });

  const resolvedCompanies = numberingOptions?.companies ?? FALLBACK_COMPANIES;
  const resolvedTechnicalUnits = numberingOptions?.technicalUnits ?? FALLBACK_TECHNICAL_UNITS;
  const requisitionFormsByProjectId = useMemo(() => new Map(requisitionForms.map((item) => [item.projectId, item])), [requisitionForms]);
  const tasks = tasksData?.items ?? [];

  const projectRows = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.project === project.name);
      return {
        id: project.id,
        projectName: project.name,
        description: project.description ?? "",
        createdAt: project.createdAt,
        projectNumber: project.projectNumber ?? "-",
        projectCodePrefix: project.projectCodePrefix ?? "",
        requisitionForm: requisitionFormsByProjectId.get(project.id) ?? null,
        totalTasks: projectTasks.length,
        pendingTasks: projectTasks.filter((task) => task.status !== "DONE").length,
        overdueTasks: projectTasks.filter((task) => isTaskOverdue(task)).length,
        projectPlan: projectPlans[project.id] ?? null,
        tasks: projectTasks
      };
    });
  }, [projects, tasks, requisitionFormsByProjectId, projectPlans]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return projectRows.filter((row) => {
      const createdAt = new Date(row.createdAt);
      const matchesSearch = !query || row.projectName.toLowerCase().includes(query) || row.projectNumber.toLowerCase().includes(query);
      const matchesFrom = !from || createdAt >= from;
      const matchesTo = !to || createdAt <= to;
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [projectRows, search, fromDate, toDate]);

  const selectedProject = useMemo(() => projectRows.find((row) => row.id === selectedProjectId) ?? null, [projectRows, selectedProjectId]);
  const selectedProjectRecord = useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const projectsWithoutNumber = useMemo(() => projects.filter((project) => !project.projectNumber), [projects]);
  const wizardProject = useMemo(() => projects.find((project) => project.id === wizard.projectId) ?? null, [projects, wizard.projectId]);
  const requisitionProject = useMemo(() => projectRows.find((row) => row.id === requisitionProjectId) ?? null, [projectRows, requisitionProjectId]);
  const planEditorProject = useMemo(() => projectRows.find((row) => row.id === planEditorProjectId) ?? null, [projectRows, planEditorProjectId]);
  const planChartProject = useMemo(() => projectRows.find((row) => row.id === planChartProjectId) ?? null, [projectRows, planChartProjectId]);
  const selectedProjectFormDirty = useMemo(() => {
    if (!selectedProjectRecord) return false;
    return selectedProjectForm.name.trim() !== selectedProjectRecord.name
      || selectedProjectForm.description.trim() !== (selectedProjectRecord.description ?? "")
      || selectedProjectForm.projectNumber.trim() !== (selectedProjectRecord.projectNumber ?? "");
  }, [selectedProjectForm, selectedProjectRecord]);

  const subTechnicalOptions = useMemo(() => {
    if (!wizard.technicalUnitCode) return [];
    return numberingOptions?.subTechnicalUnits[wizard.technicalUnitCode] ?? FALLBACK_SUB_TECHNICAL_UNITS[wizard.technicalUnitCode] ?? [];
  }, [wizard.technicalUnitCode, numberingOptions]);

  const workCategoryOptions = useMemo(() => {
    return wizard.subTechnicalUnitCode === "FH"
      ? numberingOptions?.workCategories.fieldHighwayTesting ?? FALLBACK_FH_WORK_CATEGORIES
      : numberingOptions?.workCategories.default ?? FALLBACK_DEFAULT_WORK_CATEGORIES;
  }, [wizard.subTechnicalUnitCode, numberingOptions]);

  const currentCodePreview = useMemo(() => {
    if (wizard.baseCode) return `${wizard.baseCode}${wizard.workCategoryCode}`;
    const prefixOnly = `${wizard.companyCode}${wizard.technicalUnitCode}${wizard.subTechnicalUnitCode}`;
    return prefixOnly || "-";
  }, [wizard]);

  useEffect(() => {
    const nextCompletionDate = addDays(requisitionDraft.projectStartingDate, requisitionDraft.projectDurationDays);
    if (nextCompletionDate && requisitionDraft.projectCompletionDate !== nextCompletionDate) {
      setRequisitionDraft((prev) => ({ ...prev, projectCompletionDate: nextCompletionDate }));
    }
  }, [requisitionDraft.projectStartingDate, requisitionDraft.projectDurationDays, requisitionDraft.projectCompletionDate]);

  useEffect(() => {
    if (!selectedProjectRecord) {
      setIsEditingSelectedProject(false);
      setSelectedProjectForm({ name: "", description: "", projectNumber: "" });
      return;
    }

    setIsEditingSelectedProject(false);
    setSelectedProjectForm({
      name: selectedProjectRecord.name,
      description: selectedProjectRecord.description ?? "",
      projectNumber: selectedProjectRecord.projectNumber ?? ""
    });
  }, [selectedProjectRecord]);

  const resetWizard = () => {
    setWizard(DEFAULT_WIZARD);
    setWizardStep(1);
    setShowNumberWizard(false);
  };

  const openRequisitionWizard = (projectId: string) => {
    const existing = requisitionFormsByProjectId.get(projectId);
    const project = projects.find((item) => item.id === projectId);
    const nextDraft = existing
      ? fromFormItem(existing)
      : { ...DEFAULT_REQUISITION_DRAFT, newProjectNumber: project?.projectNumber ?? "", approvedProjectNumber: project?.projectNumber ?? "" };
    setRequisitionProjectId(projectId);
    setRequisitionDraft(nextDraft);
    setShowRequisitionWizard(true);
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) return toast.error("Project name is required");
    try {
      await api.createProject({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        projectNumber: form.projectNumber.trim() || undefined
      });
      await Promise.all([refetchProjects(), refetchTasks()]);
      setForm({ name: "", description: "", projectNumber: "" });
      setShowCreate(false);
      toast.success("Project added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add project");
    }
  };

  const handleSaveSelectedProject = async () => {
    if (!selectedProjectRecord) return;

    const nextName = selectedProjectForm.name.trim();
    const nextDescription = selectedProjectForm.description.trim();
    const nextProjectNumber = selectedProjectForm.projectNumber.trim();

    if (!nextName) {
      toast.error("Project name is required");
      return;
    }

    const payload: Record<string, string> = {};
    if (nextName !== selectedProjectRecord.name) payload.name = nextName;
    if (nextDescription !== (selectedProjectRecord.description ?? "")) payload.description = nextDescription;
    if (nextProjectNumber && nextProjectNumber !== (selectedProjectRecord.projectNumber ?? "")) payload.projectNumber = nextProjectNumber;

    if (Object.keys(payload).length === 0) {
      setIsEditingSelectedProject(false);
      return;
    }

    try {
      setSavingSelectedProject(true);
      await api.updateProject(selectedProjectRecord.id, payload);
      await Promise.all([refetchProjects(), refetchTasks(), queryClient.invalidateQueries({ queryKey: ["projects"] })]);
      setIsEditingSelectedProject(false);
      toast.success("Project updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setSavingSelectedProject(false);
    }
  };

  const goNextWizard = async () => {
    if (wizardStep === 1 && !wizard.projectId) return toast.error("Please select a project");
    if (wizardStep === 2 && !wizard.companyCode) return toast.error("Please select company");
    if (wizardStep === 3 && !wizard.technicalUnitCode) return toast.error("Please select technical unit");
    if (wizardStep === 4) {
      if (!wizard.technicalUnitCode) return toast.error("Please select technical unit");
      if (!wizard.subTechnicalUnitCode) return toast.error("Please select sub technical unit");
      const projectCodePrefix = `${wizard.companyCode}${wizard.technicalUnitCode}${wizard.subTechnicalUnitCode}`;
      const fy = getFinancialYearShort();
      const fyText = String(fy).padStart(2, "0");
      const maxSerial = projects
        .map((project) => {
          if (project.projectCodePrefix === projectCodePrefix && project.financialYearShort === fy) return project.serialNumber ?? 0;
          const number = project.projectNumber?.trim();
          if (!number) return 0;
          const match = number.match(/^([A-Z]{4})(\d{2})(\d{2})[A-Z]$/);
          if (!match) return 0;
          const [, prefix, year, serial] = match;
          if (prefix !== projectCodePrefix || Number(year) !== fy) return 0;
          return Number(serial) || 0;
        })
        .reduce((max, value) => Math.max(max, value), 0);
      setWizard((prev) => ({ ...prev, baseCode: `${projectCodePrefix}${fyText}${String(maxSerial + 1).padStart(2, "0")}` }));
    }
    setWizardStep((prev) => (prev >= 5 ? 5 : ((prev + 1) as WizardStep)));
  };

  const goBackWizard = () => setWizardStep((prev) => (prev <= 1 ? 1 : ((prev - 1) as WizardStep)));

  const handleAssignProjectNumber = async () => {
    if (!wizard.projectId || !wizard.companyCode || !wizard.technicalUnitCode || !wizard.subTechnicalUnitCode || !wizard.workCategoryCode) {
      return toast.error("Please complete all required selections");
    }
    const finalProjectNumber = `${wizard.baseCode}${wizard.workCategoryCode}`;
    const projectCodePrefix = `${wizard.companyCode}${wizard.technicalUnitCode}${wizard.subTechnicalUnitCode}`;
    const financialYearShort = Number(wizard.baseCode.slice(4, 6));
    const serialNumber = Number(wizard.baseCode.slice(6, 8));

    try {
      setAssigningNumber(true);
      try {
        await api.assignProjectNumber(wizard.projectId, {
          companyCode: wizard.companyCode,
          technicalUnitCode: wizard.technicalUnitCode,
          subTechnicalUnitCode: wizard.subTechnicalUnitCode,
          workCategoryCode: wizard.workCategoryCode
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to assign project number";
        if (/route not found|404|unavailable/i.test(message)) {
          await api.updateProject(wizard.projectId, {
            projectNumber: finalProjectNumber,
            projectCodePrefix,
            companyCode: wizard.companyCode,
            technicalUnitCode: wizard.technicalUnitCode,
            subTechnicalUnitCode: wizard.subTechnicalUnitCode,
            workCategoryCode: wizard.workCategoryCode,
            financialYearShort,
            serialNumber,
            projectNumberAssignedAt: new Date().toISOString()
          });
        } else {
          throw error;
        }
      }

      await Promise.all([refetchProjects(), queryClient.invalidateQueries({ queryKey: ["projects"] })]);
      setGeneratedProjectNumber(finalProjectNumber);
      setGeneratedProjectName(wizardProject?.name ?? "Project");
      setShowGeneratedModal(true);
      toast.success("Project number generated");
      resetWizard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign project number");
    } finally {
      setAssigningNumber(false);
    }
  };

  const saveRequisitionForm = async () => {
    if (!requisitionProjectId) return;
    try {
      setSavingRequisition(true);
      await api.upsertProjectRequisitionForm(requisitionProjectId, toPayload(requisitionDraft));
      await Promise.all([refetchRequisitionForms(), queryClient.invalidateQueries({ queryKey: ["project-requisition-forms"] })]);
      setShowRequisitionWizard(false);
      toast.success("Project requisition form saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save requisition form");
    } finally {
      setSavingRequisition(false);
    }
  };

  const openProjectPlanEditor = (projectId: string) => {
    const existing = projectPlans[projectId];
    setPlanEditorProjectId(projectId);
    setPlanEditorEntries(existing?.entries?.length ? existing.entries : createDefaultProjectPlanEntries());
  };

  const updatePlanEditorEntry = (entryId: string, patch: Partial<ProjectPlanEntry>) => {
    setPlanEditorEntries((prev) => prev.map((entry) => {
      if (entry.id !== entryId) return entry;
      const next = { ...entry, ...patch };
      if (patch.startDate !== undefined || patch.days !== undefined) {
        next.endDate = calculatePlanEndDate(next.startDate, next.days);
      }
      return next;
    }));
  };

  const saveProjectPlan = () => {
    if (!planEditorProjectId) return;
    const validEntries = planEditorEntries.filter((entry) => entry.startDate && Number(entry.days) > 0);
    if (!validEntries.length) {
      toast.error("Please fill at least one sub activity with start date and days.");
      return;
    }

    const next: ProjectPlansStore = {
      ...projectPlans,
      [planEditorProjectId]: {
        generatedAt: new Date().toISOString(),
        entries: planEditorEntries
      }
    };
    persistProjectPlans(next);
    setPlanEditorProjectId(null);
    setPlanEditorEntries([]);
    toast.success("Project plan saved.");
  };

  const planChartRows = useMemo(() => {
    const entries = planChartProject?.projectPlan?.entries ?? [];
    const valid = entries
      .filter((entry) => entry.startDate && entry.endDate && Number(entry.days) > 0)
      .map((entry) => {
        const start = new Date(`${entry.startDate}T00:00:00`);
        const end = new Date(`${entry.endDate}T00:00:00`);
        return {
          ...entry,
          start,
          end,
          daysCount: Number(entry.days)
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (!valid.length) {
      return { rows: [] as Array<typeof valid[number] & { leftPct: number; widthPct: number }>, totalDays: 0 };
    }

    const minTime = Math.min(...valid.map((entry) => entry.start.getTime()));
    const maxTime = Math.max(...valid.map((entry) => entry.end.getTime()));
    const totalDays = Math.max(Math.floor((maxTime - minTime) / 86400000) + 1, 1);

    const rows = valid.map((entry) => {
      const startOffset = Math.floor((entry.start.getTime() - minTime) / 86400000);
      const spanDays = Math.max(Math.floor((entry.end.getTime() - entry.start.getTime()) / 86400000) + 1, 1);
      return {
        ...entry,
        leftPct: (startOffset / totalDays) * 100,
        widthPct: Math.max((spanDays / totalDays) * 100, 1.2)
      };
    });

    return { rows, totalDays };
  }, [planChartProject]);

  return (
    <PageWrapper>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Project-wise task status summary</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setShowNumberWizard(true); setWizardStep(1); setWizard(DEFAULT_WIZARD); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 text-primary font-medium text-sm hover:bg-primary/10 transition-colors"><Hash className="h-4 w-4" />Add Project Number</button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"><Plus className="h-4 w-4" />Add Project</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm max-w-sm w-full">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or number..." className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground w-full" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm">
          <span className="text-muted-foreground">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              const next = event.target.value;
              setFromDate(next);
              if (toDate && next && toDate < next) {
                setToDate(next);
              }
            }}
            className="bg-transparent border-none outline-none text-foreground"
            title="From date"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm">
          <span className="text-muted-foreground">To</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            className="bg-transparent border-none outline-none text-foreground"
            title="To date"
          />
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1040px]">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Project Name</th>
                <th className="text-left p-4 font-medium">Project Number</th>
                <th className="text-left p-4 font-medium">Project Plan</th>
                <th className="text-left p-4 font-medium">Task Report</th>
                <th className="text-left p-4 font-medium">Project No. Requisition Form</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <motion.tr key={row.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} onClick={() => setSelectedProjectId(row.id)} className="border-b border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <td className="p-4"><span className="font-medium">{row.projectName}</span></td>
                  <td className="p-4 font-medium">{row.projectNumber}</td>
                  <td className="p-4" onClick={(event) => event.stopPropagation()}>
                    {!row.projectNumber || row.projectNumber === "-" ? (
                      <p className="text-xs text-muted-foreground">Add project number first</p>
                    ) : row.projectPlan ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openProjectPlanEditor(row.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/20"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Plan
                        </button>
                        <button
                          onClick={() => setPlanChartProjectId(row.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/15 text-accent font-medium hover:bg-accent/20"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Bar Chart
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openProjectPlanEditor(row.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/20"
                      >
                        <FileText className="h-4 w-4" />
                        Generate Plan
                      </button>
                    )}
                  </td>
                  <td className="p-4" onClick={(event) => event.stopPropagation()}>
                    <button
                      onClick={(event) => { event.stopPropagation(); downloadProjectReport({ tasks: row.tasks, projectName: row.projectName }); }}
                      title="Download project task report"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Task Report
                    </button>
                  </td>
                  <td className="p-4" onClick={(event) => event.stopPropagation()}>
                    {!row.projectNumber || row.projectNumber === "-" ? null : row.requisitionForm ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => downloadProjectRequisitionPdf(row.requisitionForm, row.projectName, row.projectNumber)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/15 text-accent font-medium hover:bg-accent/20"><Download className="h-4 w-4" />Download PDF</button>
                        <button onClick={() => openRequisitionWizard(row.id)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/20"><Pencil className="h-4 w-4" />Edit</button>
                      </div>
                    ) : (
                      <button onClick={() => openRequisitionWizard(row.id)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/20"><FileText className="h-4 w-4" />Generate</button>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filteredRows.length === 0 && <tr><td colSpan={5} className="p-6 text-muted-foreground">No projects found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setSelectedProjectId(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={(event) => event.stopPropagation()} className="glass-panel-strong p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Project Details</h3>
              <div className="flex items-center gap-2">
                {isEditingSelectedProject ? (
                  <>
                    {selectedProjectFormDirty ? (
                      <button
                        onClick={() => void handleSaveSelectedProject()}
                        disabled={savingSelectedProject}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium disabled:opacity-60"
                      >
                        {savingSelectedProject ? "Saving..." : "Save"}
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        setIsEditingSelectedProject(false);
                        setSelectedProjectForm({
                          name: selectedProjectRecord?.name ?? "",
                          description: selectedProjectRecord?.description ?? "",
                          projectNumber: selectedProjectRecord?.projectNumber ?? ""
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border/50 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditingSelectedProject(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                )}
                <button onClick={() => setSelectedProjectId(null)} className="p-1 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Project Name</p>
                {isEditingSelectedProject ? (
                  <input
                    value={selectedProjectForm.name}
                    onChange={(event) => setSelectedProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                    placeholder="Project name"
                    title="Project name"
                  />
                ) : (
                  <p className="font-medium mt-1">{selectedProject.projectName}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Number</p>
                {isEditingSelectedProject ? (
                  <input
                    value={selectedProjectForm.projectNumber}
                    onChange={(event) => setSelectedProjectForm((prev) => ({ ...prev, projectNumber: event.target.value.toUpperCase() }))}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                    placeholder="Project number (optional)"
                    title="Project number"
                  />
                ) : (
                  <p className="font-medium mt-1">{selectedProject.projectNumber}</p>
                )}
              </div>
              <div><p className="text-xs text-muted-foreground">Project Code Prefix</p><p className="font-medium mt-1">{selectedProject.projectCodePrefix || "-"}</p></div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                {isEditingSelectedProject ? (
                  <textarea
                    value={selectedProjectForm.description}
                    onChange={(event) => setSelectedProjectForm((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                    placeholder="Project description"
                    title="Project description"
                  />
                ) : (
                  <p className="mt-1 text-sm">{selectedProject.description.trim() || "No description added."}</p>
                )}
              </div>
              <div><p className="text-xs text-muted-foreground">Total Tasks</p><p className="font-medium mt-1">{selectedProject.totalTasks}</p></div>
              <div><p className="text-xs text-muted-foreground">Pending</p><p className="font-medium mt-1">{selectedProject.pendingTasks}</p></div>
              <div><p className="text-xs text-muted-foreground">Overdue</p><p className="font-medium mt-1">{selectedProject.overdueTasks}</p></div>
              <div><p className="text-xs text-muted-foreground">Completed</p><p className="font-medium mt-1">{selectedProject.tasks.filter((task) => task.status === "DONE").length}</p></div>
              <div className="sm:col-span-2 mt-1">
                <button
                  onClick={() => downloadProjectReport({ tasks: selectedProject.tasks, projectName: selectedProject.projectName })}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Project Task Report
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Tasks In This Project</p>
              {selectedProject.tasks.length ? (
                <div className="space-y-2">
                  {[...selectedProject.tasks].sort((a, b) => { const aDone = a.status === "DONE" ? 1 : 0; const bDone = b.status === "DONE" ? 1 : 0; if (aDone !== bDone) return aDone - bDone; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); }).map((task) => (
                    <div key={task.id} className="rounded-xl border border-border/40 bg-secondary/20 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground mt-1">Assigned to: {task.assignedTo?.name ?? "-"} | Due: {new Date(task.dueDate).toLocaleDateString()}</p></div><span className={`status-badge text-[10px] ${statusConfig[task.status].color}`}>{statusConfig[task.status].label}</span></div></div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No tasks in this project yet.</p>}
            </div>
          </motion.div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Add Project</h3><button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary/50" title="Close" aria-label="Close"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50" placeholder="Project name" title="Project name" />
              <input value={form.projectNumber} onChange={(event) => setForm((prev) => ({ ...prev, projectNumber: event.target.value.toUpperCase() }))} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50" placeholder="Project number (optional)" title="Project number" />
              <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50" placeholder="Project description (optional)" title="Project description" />
              <button onClick={() => void handleCreateProject()} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity">Create Project</button>
            </div>
          </motion.div>
        </div>
      )}

      {showNumberWizard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="text-lg font-semibold">Add Project Number</h3><p className="text-xs text-muted-foreground mt-1">Step {wizardStep} of 5 | Project: {wizardProject?.name ?? "Not selected"} | Current Code: {currentCodePreview}</p></div><button onClick={resetWizard} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs">Discard</button></div>
            {wizardStep === 1 && <div className="space-y-3"><p className="text-sm font-medium">Select Project (only projects without number)</p><select value={wizard.projectId} onChange={(event) => setWizard((prev) => ({ ...prev, projectId: event.target.value }))} title="Select project" aria-label="Select project" className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50"><option value="">Select project</option>{projectsWithoutNumber.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{projectsWithoutNumber.length === 0 && <p className="text-xs text-muted-foreground">All projects already have numbers.</p>}</div>}
            {wizardStep === 2 && <div className="space-y-3"><p className="text-sm font-medium">a) Initial of Company Name (select one)</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{resolvedCompanies.map((item) => <button key={item.code} onClick={() => setWizard((prev) => ({ ...prev, companyCode: item.code as NumberWizardState["companyCode"] }))} className={`text-left px-3 py-2 rounded-xl border ${wizard.companyCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Code: {item.code}</p></button>)}</div></div>}
            {wizardStep === 3 && <div className="space-y-3"><p className="text-sm font-medium">b) Initial of Technical Unit (select one)</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{resolvedTechnicalUnits.map((item) => <button key={item.code} onClick={() => setWizard((prev) => ({ ...prev, technicalUnitCode: item.code as NumberWizardState["technicalUnitCode"], subTechnicalUnitCode: "", workCategoryCode: "", baseCode: "" }))} className={`text-left px-3 py-2 rounded-xl border ${wizard.technicalUnitCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Code: {item.code}</p></button>)}</div></div>}
            {wizardStep === 4 && <div className="space-y-3"><p className="text-sm font-medium">c) Initial of Sub Technical Unit ({wizard.technicalUnitCode})</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">{subTechnicalOptions.map((item) => <button key={item.code} onClick={() => setWizard((prev) => ({ ...prev, subTechnicalUnitCode: item.code, workCategoryCode: "", baseCode: "" }))} className={`text-left px-3 py-2 rounded-xl border ${wizard.subTechnicalUnitCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Code: {item.code}</p></button>)}</div></div>}
            {wizardStep === 5 && <div className="space-y-3"><p className="text-sm font-medium">f) Prefix Initial of Work Category</p><p className="text-xs text-muted-foreground">{wizard.subTechnicalUnitCode === "FH" ? "Field Highway Testing selected, choose one service code" : "Choose one work category code"}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">{workCategoryOptions.map((item) => <button key={item.code} onClick={() => setWizard((prev) => ({ ...prev, workCategoryCode: item.code }))} className={`text-left px-3 py-2 rounded-xl border ${wizard.workCategoryCode === item.code ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20"}`}><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">Code: {item.code}</p></button>)}</div>{wizard.baseCode && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Generated Base Code</p><p className="text-base font-semibold mt-1">{wizard.baseCode}</p><p className="text-xs text-muted-foreground mt-1">Final Project Number: {wizard.baseCode}{wizard.workCategoryCode || ""}</p></div>}</div>}
            <div className="flex items-center justify-between gap-2 mt-5"><button onClick={goBackWizard} disabled={wizardStep === 1} className="px-4 py-2 rounded-lg border border-border/50 text-sm disabled:opacity-40">Back</button>{wizardStep < 5 ? <button onClick={() => void goNextWizard()} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium">Next</button> : <button onClick={() => void handleAssignProjectNumber()} disabled={assigningNumber || !wizard.workCategoryCode} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium disabled:opacity-60">{assigningNumber ? "Assigning..." : "Finish"}</button>}</div>
          </motion.div>
        </div>
      )}

      {showGeneratedModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4"><h3 className="text-lg font-semibold">Project Number Generated</h3><p className="text-sm text-muted-foreground mt-2">{generatedProjectName}</p><p className="text-2xl font-bold mt-3 tracking-wide">{generatedProjectNumber}</p><button onClick={() => setShowGeneratedModal(false)} className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium">OK</button></motion.div>
        </div>
      )}

      {showRequisitionWizard && requisitionProject && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-5xl mx-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="text-lg font-semibold">Project No. Requisition Form</h3><p className="text-xs text-muted-foreground mt-1">Project: {requisitionProject.projectName}</p></div><button onClick={() => setShowRequisitionWizard(false)} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs">Close</button></div>

            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Department Information</div>
              <ProjectRequisitionStepContent step={1} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Client Information</div>
              <ProjectRequisitionStepContent step={2} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Contact Information</div>
              <ProjectRequisitionStepContent step={3} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Work Order Details</div>
              <ProjectRequisitionStepContent step={4} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Project Details</div>
              <ProjectRequisitionStepContent step={5} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Financial Details</div>
              <ProjectRequisitionStepContent step={6} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Work Description</div>
              <ProjectRequisitionStepContent step={7} draft={requisitionDraft} setDraft={setRequisitionDraft} />

              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium">Approval</div>
              <ProjectRequisitionStepContent step={8} draft={requisitionDraft} setDraft={setRequisitionDraft} />
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowRequisitionWizard(false)} className="px-4 py-2 rounded-lg border border-border/50 text-sm">Cancel</button>
              <button onClick={() => void saveRequisitionForm()} disabled={savingRequisition} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium disabled:opacity-60">{savingRequisition ? "Saving..." : "Generate"}</button>
            </div>
          </motion.div>
        </div>
      )}

      {planEditorProject && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-6xl mx-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Project Plan</h3>
                <p className="text-xs text-muted-foreground mt-1">Project: {planEditorProject.projectName}</p>
              </div>
              <button onClick={() => setPlanEditorProjectId(null)} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs">Close</button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20">
                    <th className="text-left p-3 font-medium">Activity</th>
                    <th className="text-left p-3 font-medium">Sub Activity</th>
                    <th className="text-left p-3 font-medium">Start Date</th>
                    <th className="text-left p-3 font-medium">Days</th>
                    <th className="text-left p-3 font-medium">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {planEditorEntries.map((entry, index) => {
                    const isFirstInActivity = planEditorEntries.findIndex((item) => item.activityCode === entry.activityCode) === index;
                    const activityRowCount = isFirstInActivity
                      ? planEditorEntries.filter((item) => item.activityCode === entry.activityCode).length
                      : 0;

                    return (
                      <tr key={entry.id} className="border-b border-border/20 align-top">
                        {isFirstInActivity ? (
                          <td rowSpan={activityRowCount} className="p-3 bg-secondary/10 min-w-[210px]">
                            <p className="text-xs text-muted-foreground">{entry.activityCode}</p>
                            <p className="font-medium mt-0.5">{entry.activityName}</p>
                          </td>
                        ) : null}
                        <td className="p-3 min-w-[320px]">
                          <p className="text-xs text-muted-foreground">{entry.subActivityCode}</p>
                          <p className="text-sm mt-0.5">{entry.subActivityName}</p>
                        </td>
                        <td className="p-3 min-w-[170px]">
                          <input
                            type="date"
                            value={entry.startDate}
                            onChange={(event) => updatePlanEditorEntry(entry.id, { startDate: event.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50"
                            title={`Start date for ${entry.subActivityName}`}
                            aria-label={`Start date for ${entry.subActivityName}`}
                          />
                        </td>
                        <td className="p-3 min-w-[120px]">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={entry.days}
                            onChange={(event) => updatePlanEditorEntry(entry.id, { days: event.target.value.replace(/\D/g, "") })}
                            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/50"
                            placeholder="Days"
                            title={`Days for ${entry.subActivityName}`}
                            aria-label={`Days for ${entry.subActivityName}`}
                          />
                        </td>
                        <td className="p-3 min-w-[170px]">
                          <input
                            type="date"
                            value={entry.endDate}
                            readOnly
                            className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/40 text-muted-foreground"
                            title={`Auto end date for ${entry.subActivityName}`}
                            aria-label={`Auto end date for ${entry.subActivityName}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setPlanEditorProjectId(null)} className="px-4 py-2 rounded-lg border border-border/50 text-sm">Cancel</button>
              <button onClick={saveProjectPlan} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium">
                {planEditorProject.projectPlan ? "Save Plan" : "Generate Plan"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {planChartProject && (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-6xl mx-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Project Plan Bar Chart</h3>
                <p className="text-xs text-muted-foreground mt-1">Project: {planChartProject.projectName}</p>
              </div>
              <button onClick={() => setPlanChartProjectId(null)} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs">Close</button>
            </div>

            {planChartRows.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled activities found. Please edit plan and fill start date plus days.</p>
            ) : (
              <div className="rounded-xl border border-border/40 p-4 bg-secondary/10">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Y Axis: Activities</span>
                  <span>X Axis: Days (0 - {planChartRows.totalDays})</span>
                </div>

                <div className="space-y-2">
                  {planChartRows.rows.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[320px_1fr] items-center gap-3">
                      <div className="text-xs leading-4">
                        <p className="font-medium text-foreground">{entry.subActivityCode} {entry.subActivityName}</p>
                        <p className="text-muted-foreground mt-0.5">{entry.startDate} to {entry.endDate} ({entry.days} days)</p>
                      </div>
                      <svg viewBox="0 0 1000 32" preserveAspectRatio="none" className="h-8 w-full rounded-lg bg-secondary/50 border border-border/40 overflow-hidden" role="img" aria-label={`${entry.subActivityName}: ${entry.days} days`}>
                        <rect
                          x={(entry.leftPct / 100) * 1000}
                          y={2}
                          width={Math.max((entry.widthPct / 100) * 1000, 12)}
                          height={28}
                          rx={6}
                          className="fill-primary"
                          opacity={0.9}
                        />
                      </svg>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-border/30 pt-3">
                  <svg viewBox="0 0 1000 28" preserveAspectRatio="none" className="h-7 w-full">
                    {[0, 0.25, 0.5, 0.75, 1].map((point) => (
                      <g key={point}>
                        <line x1={point * 1000} y1={0} x2={point * 1000} y2={10} stroke="currentColor" className="text-border" strokeWidth="1" />
                        <text x={point * 1000} y={24} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                          {Math.round(planChartRows.totalDays * point)}d
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
