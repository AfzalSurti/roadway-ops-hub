import type { SubStaffAssignment, SubStaffAssignmentStatus } from "@/lib/domain";

export type SubStaffFormState = {
  siteName: string;
  staffName: string;
  designation: string;
  coOrdinator: string;
  rate: string;
  constructionPeriodMonths: string;
  dlpMonths: string;
  totalPeriodMonths: string;
  commencementDate: string;
  lastBilledMonth: string;
  lastBilledDate: string;
  mmConstruction: string;
  mmDlp: string;
  mmEot: string;
  totalMm: string;
  usedMm: string;
  remark: string;
  status: SubStaffAssignmentStatus;
  leftDate: string;
};

export const emptySubStaffForm: SubStaffFormState = {
  siteName: "",
  staffName: "",
  designation: "",
  coOrdinator: "",
  rate: "",
  constructionPeriodMonths: "",
  dlpMonths: "",
  totalPeriodMonths: "",
  commencementDate: "",
  lastBilledMonth: "",
  lastBilledDate: "",
  mmConstruction: "",
  mmDlp: "",
  mmEot: "",
  totalMm: "",
  usedMm: "",
  remark: "",
  status: "ACTIVE",
  leftDate: ""
};

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function subStaffFormFromEntry(entry: SubStaffAssignment): SubStaffFormState {
  return {
    siteName: entry.siteName,
    staffName: entry.staffName,
    designation: entry.designation,
    coOrdinator: entry.coOrdinator,
    rate: entry.rate ? String(entry.rate) : "",
    constructionPeriodMonths: entry.constructionPeriodMonths ? String(entry.constructionPeriodMonths) : "",
    dlpMonths: entry.dlpMonths ? String(entry.dlpMonths) : "",
    totalPeriodMonths: entry.totalPeriodMonths ? String(entry.totalPeriodMonths) : "",
    commencementDate: toDateInput(entry.commencementDate),
    lastBilledMonth: toDateInput(entry.lastBilledMonth),
    lastBilledDate: toDateInput(entry.lastBilledDate),
    mmConstruction: entry.mmConstruction ? String(entry.mmConstruction) : "",
    mmDlp: entry.mmDlp ? String(entry.mmDlp) : "",
    mmEot: entry.mmEot ? String(entry.mmEot) : "",
    totalMm: entry.totalMm ? String(entry.totalMm) : "",
    usedMm: entry.usedMm ? String(entry.usedMm) : "",
    remark: entry.remark,
    status: entry.status,
    leftDate: toDateInput(entry.leftDate)
  };
}

/** Light, non-destructive defaults: total period / total MM default to the sum of their parts, only
 * while still blank — never overwrite a value the client's own sheet (or a user) already set. */
export function applySubStaffDefaults(form: SubStaffFormState, changedKey?: keyof SubStaffFormState): SubStaffFormState {
  let next = form;
  if (
    (!changedKey || changedKey === "constructionPeriodMonths" || changedKey === "dlpMonths") &&
    !next.totalPeriodMonths
  ) {
    const sum = (Number(next.constructionPeriodMonths) || 0) + (Number(next.dlpMonths) || 0);
    if (sum > 0) next = { ...next, totalPeriodMonths: String(sum) };
  }
  if (
    (!changedKey || changedKey === "mmConstruction" || changedKey === "mmDlp" || changedKey === "mmEot") &&
    !next.totalMm
  ) {
    const sum = (Number(next.mmConstruction) || 0) + (Number(next.mmDlp) || 0) + (Number(next.mmEot) || 0);
    if (sum > 0) next = { ...next, totalMm: String(sum) };
  }
  return next;
}

export function subStaffFormToPayload(form: SubStaffFormState) {
  return {
    siteName: form.siteName.trim(),
    staffName: form.staffName.trim(),
    designation: form.designation.trim(),
    coOrdinator: form.coOrdinator.trim(),
    rate: Number(form.rate) || 0,
    constructionPeriodMonths: Number(form.constructionPeriodMonths) || 0,
    dlpMonths: Number(form.dlpMonths) || 0,
    totalPeriodMonths: Number(form.totalPeriodMonths) || 0,
    commencementDate: form.commencementDate || null,
    lastBilledMonth: form.lastBilledMonth || null,
    lastBilledDate: form.lastBilledDate || null,
    mmConstruction: Number(form.mmConstruction) || 0,
    mmDlp: Number(form.mmDlp) || 0,
    mmEot: Number(form.mmEot) || 0,
    totalMm: Number(form.totalMm) || 0,
    usedMm: Number(form.usedMm) || 0,
    remark: form.remark.trim(),
    status: form.status,
    leftDate: form.leftDate || null
  };
}

const textClass = "w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm disabled:opacity-70";

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{
    key: keyof SubStaffFormState;
    label: string;
    type?: "text" | "date" | "number" | "select";
    placeholder?: string;
  }>;
}> = [
  {
    title: "Identity",
    fields: [
      { key: "staffName", label: "Staff Name" },
      { key: "designation", label: "Designation", placeholder: "e.g. CAD Expert" },
      { key: "siteName", label: "Site / Client", placeholder: "e.g. MORTH NANDYAL" },
      { key: "coOrdinator", label: "Co-Ordinator" }
    ]
  },
  {
    title: "Period & Dates",
    fields: [
      { key: "commencementDate", label: "Commencement Date", type: "date" },
      { key: "constructionPeriodMonths", label: "Construction Period (Months)", type: "number" },
      { key: "dlpMonths", label: "DLP (Months)", type: "number" },
      { key: "totalPeriodMonths", label: "Total Period (Months, Auto)", type: "number" },
      { key: "lastBilledMonth", label: "Last Billed Month", type: "date" },
      { key: "lastBilledDate", label: "Last Billed Date", type: "date" }
    ]
  },
  {
    title: "Man-Months",
    fields: [
      { key: "rate", label: "Rate (₹ / month)", type: "number" },
      { key: "mmConstruction", label: "MM (Construction)", type: "number" },
      { key: "mmDlp", label: "MM (DLP)", type: "number" },
      { key: "mmEot", label: "MM (EOT)", type: "number" },
      { key: "totalMm", label: "Total MM (Auto)", type: "number" },
      { key: "usedMm", label: "Used MM", type: "number" }
    ]
  },
  {
    title: "Status & Remark",
    fields: [
      { key: "status", label: "Status", type: "select" },
      { key: "leftDate", label: "Left Date (if Left)", type: "date" },
      { key: "remark", label: "Remark" }
    ]
  }
];

export function SubStaffFormFields({
  value,
  onChange,
  readOnly = false
}: {
  value: SubStaffFormState;
  onChange: (patch: Partial<SubStaffFormState>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      {FIELD_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-medium text-muted-foreground mb-2">{group.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    value={value[field.key]}
                    disabled={readOnly}
                    onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<SubStaffFormState>)}
                    className={textClass}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="LEFT">Left</option>
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    step={field.type === "number" ? "0.01" : undefined}
                    placeholder={field.placeholder}
                    value={value[field.key]}
                    disabled={readOnly}
                    onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<SubStaffFormState>)}
                    className={textClass}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
