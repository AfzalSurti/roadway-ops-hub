import type { ProjectBillingEntry } from "@/lib/domain";

export type BillFormState = {
  date: string;
  raBillNo: string;
  billNo: string;
  month: string;
  basicAmountClaimed: string;
  basicAmountPassed: string;
  gstAmount: string;
  totalAmount: string;
  tds: string;
  sdRetention: string;
  gstDeduction: string;
  amountToReceive: string;
  chequeAmount: string;
  amountHold: string;
  gstReceived: string;
};

export const emptyBillForm: BillFormState = {
  date: "",
  raBillNo: "",
  billNo: "",
  month: "",
  basicAmountClaimed: "",
  basicAmountPassed: "",
  gstAmount: "",
  totalAmount: "",
  tds: "",
  sdRetention: "",
  gstDeduction: "",
  amountToReceive: "",
  chequeAmount: "",
  amountHold: "",
  gstReceived: ""
};

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function billFormFromEntry(entry: ProjectBillingEntry): BillFormState {
  return {
    date: toDateInput(entry.date),
    raBillNo: entry.raBillNo,
    billNo: entry.billNo,
    month: entry.month,
    basicAmountClaimed: entry.basicAmountClaimed ? String(entry.basicAmountClaimed) : "",
    basicAmountPassed: entry.basicAmountPassed ? String(entry.basicAmountPassed) : "",
    gstAmount: entry.gstAmount ? String(entry.gstAmount) : "",
    totalAmount: entry.totalAmount ? String(entry.totalAmount) : "",
    tds: entry.tds ? String(entry.tds) : "",
    sdRetention: entry.sdRetention ? String(entry.sdRetention) : "",
    gstDeduction: entry.gstDeduction ? String(entry.gstDeduction) : "",
    amountToReceive: entry.amountToReceive ? String(entry.amountToReceive) : "",
    chequeAmount: entry.chequeAmount ? String(entry.chequeAmount) : "",
    amountHold: entry.amountHold ? String(entry.amountHold) : "",
    gstReceived: entry.gstReceived ? String(entry.gstReceived) : ""
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Live-calculates GST / Total / TDS / GST-deduction / Amount-to-Receive from the claim amount and the
 * other manually-entered deductions, so typing the claimed (or passed) amount fills the rest in —
 * still plain editable fields afterward, this just sets sensible defaults.
 * Rates: 18% GST (standard), 2% income-tax TDS and 2% GST-TDS (common contractor/works-contract rates
 * for government RA bills) — adjust the entered values directly if your contract uses different rates.
 */
const AUTO_CALC_TRIGGERS = new Set<keyof BillFormState>([
  "basicAmountClaimed",
  "basicAmountPassed",
  "sdRetention",
  "amountHold"
]);

export function applyAutoCalc(form: BillFormState, changedKey?: keyof BillFormState): BillFormState {
  if (changedKey && !AUTO_CALC_TRIGGERS.has(changedKey)) return form;

  const base = Number(form.basicAmountPassed) || Number(form.basicAmountClaimed) || 0;
  if (base <= 0) return form;

  const gstAmount = round2(base * 0.18);
  const totalAmount = round2(base + gstAmount);
  const tds = round2(base * 0.02);
  const gstDeduction = round2(base * 0.02);
  const sdRetention = Number(form.sdRetention) || 0;
  const amountHold = Number(form.amountHold) || 0;
  const amountToReceive = round2(totalAmount - tds - gstDeduction - sdRetention - amountHold);

  return {
    ...form,
    gstAmount: String(gstAmount),
    totalAmount: String(totalAmount),
    tds: String(tds),
    gstDeduction: String(gstDeduction),
    amountToReceive: String(amountToReceive)
  };
}

export function billFormToPayload(form: BillFormState) {
  return {
    date: form.date || null,
    raBillNo: form.raBillNo,
    billNo: form.billNo,
    month: form.month,
    basicAmountClaimed: Number(form.basicAmountClaimed) || 0,
    basicAmountPassed: Number(form.basicAmountPassed) || 0,
    gstAmount: Number(form.gstAmount) || 0,
    totalAmount: Number(form.totalAmount) || 0,
    tds: Number(form.tds) || 0,
    sdRetention: Number(form.sdRetention) || 0,
    gstDeduction: Number(form.gstDeduction) || 0,
    amountToReceive: Number(form.amountToReceive) || 0,
    chequeAmount: Number(form.chequeAmount) || 0,
    amountHold: Number(form.amountHold) || 0,
    gstReceived: Number(form.gstReceived) || 0
  };
}

const textClass = "w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm disabled:opacity-70";

const FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{ key: keyof BillFormState; label: string; type?: "text" | "date" | "number"; placeholder?: string }>;
}> = [
  {
    title: "Bill Details",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "raBillNo", label: "RA Bill No." },
      { key: "billNo", label: "Bill No." },
      { key: "month", label: "Month", placeholder: "e.g. August 2025" }
    ]
  },
  {
    title: "Claim",
    fields: [
      { key: "basicAmountClaimed", label: "Basic Amount Claimed", type: "number" },
      { key: "basicAmountPassed", label: "Basic Amount Passed by Client", type: "number" },
      { key: "gstAmount", label: "18% GST", type: "number" },
      { key: "totalAmount", label: "Total Amount", type: "number" }
    ]
  },
  {
    title: "Payment Received",
    fields: [
      { key: "tds", label: "TDS", type: "number" },
      { key: "sdRetention", label: "SD / Retention Money", type: "number" },
      { key: "gstDeduction", label: "GST", type: "number" },
      { key: "amountToReceive", label: "Amount to be Received", type: "number" },
      { key: "chequeAmount", label: "Chq. Amt", type: "number" },
      { key: "amountHold", label: "Amt Hold", type: "number" },
      { key: "gstReceived", label: "GST Received", type: "number" }
    ]
  }
];

export function BillFormFields({
  value,
  onChange,
  readOnly = false
}: {
  value: BillFormState;
  onChange: (patch: Partial<BillFormState>) => void;
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
                <input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  step={field.type === "number" ? "0.01" : undefined}
                  placeholder={field.placeholder}
                  value={value[field.key]}
                  disabled={readOnly}
                  onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<BillFormState>)}
                  className={textClass}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
