import { useState } from "react";
import type { SubStaffAssignment, SubStaffAssignmentStatus } from "@/lib/domain";

export type ProjectOption = { id: string; name: string; projectNumber: string | null };

export type SubStaffFormState = {
  projectId: string;
  siteName: string;
  projectNumber: string;
  staffName: string;
  designation: string;
  coOrdinator: string;
  rate: string;
  constructionPeriodMonths: string;
  dlpMonths: string;
  totalPeriodMonths: string;
  startDate: string;
  endDate: string;
  lastBilledMonth: string;
  lastBilledDate: string;
  mmConstruction: string;
  mmDlp: string;
  mmEot: string;
  totalMm: string;
  usedMm: string;
  remark: string;
  status: SubStaffAssignmentStatus;
};

export const emptySubStaffForm: SubStaffFormState = {
  projectId: "",
  siteName: "",
  projectNumber: "",
  staffName: "",
  designation: "",
  coOrdinator: "",
  rate: "",
  constructionPeriodMonths: "",
  dlpMonths: "",
  totalPeriodMonths: "",
  startDate: "",
  endDate: "",
  lastBilledMonth: "",
  lastBilledDate: "",
  mmConstruction: "",
  mmDlp: "",
  mmEot: "",
  totalMm: "",
  usedMm: "",
  remark: "",
  status: "ACTIVE"
};

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function subStaffFormFromEntry(
  entry: SubStaffAssignment & { projectNumber?: string | null }
): SubStaffFormState {
  return {
    projectId: entry.projectId || "",
    siteName: entry.siteName,
    projectNumber: entry.projectNumber || "",
    staffName: entry.staffName,
    designation: entry.designation,
    coOrdinator: entry.coOrdinator,
    rate: entry.rate ? String(entry.rate) : "",
    constructionPeriodMonths: entry.constructionPeriodMonths ? String(entry.constructionPeriodMonths) : "",
    dlpMonths: entry.dlpMonths ? String(entry.dlpMonths) : "",
    totalPeriodMonths: entry.totalPeriodMonths ? String(entry.totalPeriodMonths) : "",
    startDate: toDateInput(entry.startDate),
    endDate: toDateInput(entry.endDate),
    lastBilledMonth: toDateInput(entry.lastBilledMonth),
    lastBilledDate: toDateInput(entry.lastBilledDate),
    mmConstruction: entry.mmConstruction ? String(entry.mmConstruction) : "",
    mmDlp: entry.mmDlp ? String(entry.mmDlp) : "",
    mmEot: entry.mmEot ? String(entry.mmEot) : "",
    totalMm: entry.totalMm ? String(entry.totalMm) : "",
    usedMm: entry.usedMm ? String(entry.usedMm) : "",
    remark: entry.remark,
    status: entry.status
  };
}

/** Adds (whole) months to a "YYYY-MM-DD" string using local-date arithmetic. */
function addMonthsToDateInput(value: string, months: number): string {
  if (!value || !months) return "";
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1 + Math.round(months), d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Light, non-destructive defaults — only fill a field while it's still blank (or recompute End Date
 * specifically when Start Date / Total Period change, since those are its only inputs): never overwrite
 * something the client's own sheet, or the user, already set.
 */
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
  if (!changedKey || changedKey === "startDate" || changedKey === "totalPeriodMonths") {
    const computed = addMonthsToDateInput(next.startDate, Number(next.totalPeriodMonths) || 0);
    if (computed) next = { ...next, endDate: computed };
  }
  return next;
}

export function subStaffFormToPayload(form: SubStaffFormState) {
  return {
    projectId: form.projectId || null,
    siteName: form.siteName.trim(),
    projectNumber: form.projectNumber.trim(),
    staffName: form.staffName.trim(),
    designation: form.designation.trim(),
    coOrdinator: form.coOrdinator.trim(),
    rate: Number(form.rate) || 0,
    constructionPeriodMonths: Number(form.constructionPeriodMonths) || 0,
    dlpMonths: Number(form.dlpMonths) || 0,
    totalPeriodMonths: Number(form.totalPeriodMonths) || 0,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    lastBilledMonth: form.lastBilledMonth || null,
    lastBilledDate: form.lastBilledDate || null,
    mmConstruction: Number(form.mmConstruction) || 0,
    mmDlp: Number(form.mmDlp) || 0,
    mmEot: Number(form.mmEot) || 0,
    totalMm: Number(form.totalMm) || 0,
    usedMm: Number(form.usedMm) || 0,
    remark: form.remark.trim(),
    status: form.status
  };
}

const textClass = "w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm disabled:opacity-70";
const labelClass = "text-xs text-muted-foreground mb-1 block";

/** Select-from-known-list + "Other" free text, like the Professional Staff category/position pickers —
 * whatever's typed via "Other" is sent as plain text, and becomes a real option for everyone else the
 * next time this list is fetched (it's a live distinct-values query, not a fixed catalog). */
function OptionPickerField({
  value,
  options,
  onChange,
  placeholder
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [otherMode, setOtherMode] = useState(false);

  if (otherMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={textClass}
        />
        <button
          type="button"
          onClick={() => setOtherMode(false)}
          className="text-[10px] text-muted-foreground shrink-0 hover:text-foreground"
        >
          List
        </button>
      </div>
    );
  }

  const optionList = value.trim() && !options.includes(value.trim()) ? [...options, value.trim()] : options;
  return (
    <select
      value={value.trim() || "__none__"}
      onChange={(e) => {
        if (e.target.value === "__other__") {
          setOtherMode(true);
          return;
        }
        onChange(e.target.value === "__none__" ? "" : e.target.value);
      }}
      className={textClass}
    >
      <option value="__none__">Select {placeholder}</option>
      {optionList.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
      <option value="__other__">Other (type custom)</option>
    </select>
  );
}

/** Project picker — selecting an existing project fills its number in; "Other" lets you type a brand
 * new project name (+ an optional number), which creates a real Project record on save. */
function ProjectPickerField({
  projectId,
  siteName,
  projects,
  onChange
}: {
  projectId: string;
  siteName: string;
  projects: ProjectOption[];
  onChange: (patch: { projectId: string; siteName: string; projectNumber?: string }) => void;
}) {
  const [otherMode, setOtherMode] = useState(() => Boolean(siteName) && !projectId);

  if (otherMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={siteName}
          onChange={(e) => onChange({ projectId: "", siteName: e.target.value })}
          placeholder="New project name"
          className={textClass}
        />
        {projects.length > 0 ? (
          <button
            type="button"
            onClick={() => setOtherMode(false)}
            className="text-[10px] text-muted-foreground shrink-0 hover:text-foreground"
          >
            List
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <select
      value={projectId || "__none__"}
      onChange={(e) => {
        if (e.target.value === "__other__") {
          setOtherMode(true);
          onChange({ projectId: "", siteName: "" });
          return;
        }
        if (e.target.value === "__none__") {
          onChange({ projectId: "", siteName: "" });
          return;
        }
        const project = projects.find((p) => p.id === e.target.value);
        onChange({ projectId: e.target.value, siteName: project?.name ?? "", projectNumber: project?.projectNumber ?? "" });
      }}
      className={textClass}
    >
      <option value="__none__">Select project</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.projectNumber ? `${p.name} (${p.projectNumber})` : p.name}
        </option>
      ))}
      <option value="__other__">Other (add new project)</option>
    </select>
  );
}

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{
    key: keyof SubStaffFormState;
    label: string;
    type?: "text" | "date" | "number" | "select";
  }>;
}> = [
  {
    title: "Period & Dates",
    fields: [
      { key: "startDate", label: "Start Date", type: "date" },
      { key: "constructionPeriodMonths", label: "Construction Period (Months)", type: "number" },
      { key: "dlpMonths", label: "DLP (Months)", type: "number" },
      { key: "totalPeriodMonths", label: "Total Period (Months, Auto)", type: "number" },
      { key: "endDate", label: "End Date (Auto)", type: "date" },
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
      { key: "remark", label: "Remark" }
    ]
  }
];

export function SubStaffFormFields({
  value,
  onChange,
  designationOptions,
  staffNameOptions,
  projectOptions,
  readOnly = false
}: {
  value: SubStaffFormState;
  onChange: (patch: Partial<SubStaffFormState>) => void;
  designationOptions: string[];
  staffNameOptions: string[];
  projectOptions: ProjectOption[];
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Identity</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Staff Name</label>
            {readOnly ? (
              <input value={value.staffName} disabled className={textClass} />
            ) : (
              <OptionPickerField
                value={value.staffName}
                options={staffNameOptions}
                onChange={(staffName) => onChange({ staffName })}
                placeholder="staff name"
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Designation</label>
            {readOnly ? (
              <input value={value.designation} disabled className={textClass} />
            ) : (
              <OptionPickerField
                value={value.designation}
                options={designationOptions}
                onChange={(designation) => onChange({ designation })}
                placeholder="designation"
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Project Name</label>
            {readOnly ? (
              <input value={value.siteName} disabled className={textClass} />
            ) : (
              <ProjectPickerField
                projectId={value.projectId}
                siteName={value.siteName}
                projects={projectOptions}
                onChange={(patch) => onChange(patch)}
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Project Number</label>
            <input
              value={value.projectNumber}
              disabled={readOnly}
              onChange={(e) => onChange({ projectNumber: e.target.value })}
              placeholder="Leave blank if not yet assigned"
              className={textClass}
            />
          </div>
          <div>
            <label className={labelClass}>Co-Ordinator</label>
            <input
              value={value.coOrdinator}
              disabled={readOnly}
              onChange={(e) => onChange({ coOrdinator: e.target.value })}
              className={textClass}
            />
          </div>
        </div>
      </div>

      {FIELD_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-medium text-muted-foreground mb-2">{group.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.fields.map((field) => (
              <div key={field.key}>
                <label className={labelClass}>{field.label}</label>
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
