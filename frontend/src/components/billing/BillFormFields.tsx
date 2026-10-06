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
  creditAmount: string;
  creditGst: string;
  creditTotal: string;
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
  creditAmount: "",
  creditGst: "",
  creditTotal: "",
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
    creditAmount: entry.creditAmount ? String(entry.creditAmount) : "",
    creditGst: entry.creditGst ? String(entry.creditGst) : "",
    creditTotal: entry.creditTotal ? String(entry.creditTotal) : "",
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
 * Live-calculates derived amounts as the claim/payment fields are filled, so the dependent columns
 * fill themselves in — still plain editable fields afterward, this just sets sensible defaults that
 * get recomputed only when the field(s) they depend on change (so a manual override elsewhere is never
 * silently clobbered by an unrelated edit).
 *
 * Auto-calculated (and off what):
 *  - 18% GST, Total Amount: 18% of Basic Amount Passed (or Claimed if not yet passed), + that base.
 *  - Credit Amount / GST on Credit / Credit Total: when the client passes less than was claimed, the
 *    shortfall (Claimed − Passed) is billed as a credit note next cycle, with its own 18% GST.
 *  - Amount to be Received: Total Amount − TDS − SD/Retention − GST, all three of which are typed in
 *    directly (see below) — so this recomputes whenever any of those four inputs change.
 *  - Amt Hold: Amount to be Received − Chq. Amt — whatever wasn't paid out is sitting on hold.
 * Manual (no universal formula — contract/payment-specific): TDS, SD/Retention Money, GST (the
 * Payment Received figure), Chq. Amt, and GST Received.
 */
const CLAIM_CALC_TRIGGERS = new Set<keyof BillFormState>(["basicAmountClaimed", "basicAmountPassed"]);
const RECEIVE_CALC_TRIGGERS = new Set<keyof BillFormState>([
  "basicAmountClaimed",
  "basicAmountPassed",
  "tds",
  "sdRetention",
  "gstDeduction"
]);
const HOLD_CALC_TRIGGERS = new Set<keyof BillFormState>([...RECEIVE_CALC_TRIGGERS, "chequeAmount"]);

export function applyAutoCalc(form: BillFormState, changedKey?: keyof BillFormState): BillFormState {
  let next = form;

  if (!changedKey || CLAIM_CALC_TRIGGERS.has(changedKey)) {
    const claimed = Number(next.basicAmountClaimed) || 0;
    const passed = Number(next.basicAmountPassed) || 0;
    const gstBase = passed || claimed;
    if (gstBase > 0) {
      const gstAmount = round2(gstBase * 0.18);
      const totalAmount = round2(gstBase + gstAmount);
      next = { ...next, gstAmount: String(gstAmount), totalAmount: String(totalAmount) };
    }

    if (claimed > 0 && passed > 0 && claimed > passed) {
      const creditAmount = round2(claimed - passed);
      const creditGst = round2(creditAmount * 0.18);
      next = {
        ...next,
        creditAmount: String(creditAmount),
        creditGst: String(creditGst),
        creditTotal: String(round2(creditAmount + creditGst))
      };
    } else {
      next = { ...next, creditAmount: "", creditGst: "", creditTotal: "" };
    }
  }

  if (!changedKey || RECEIVE_CALC_TRIGGERS.has(changedKey)) {
    const totalAmount = Number(next.totalAmount) || 0;
    if (totalAmount > 0) {
      const tds = Number(next.tds) || 0;
      const sdRetention = Number(next.sdRetention) || 0;
      const gstDeduction = Number(next.gstDeduction) || 0;
      next = { ...next, amountToReceive: String(round2(totalAmount - tds - sdRetention - gstDeduction)) };
    }
  }

  if (!changedKey || HOLD_CALC_TRIGGERS.has(changedKey)) {
    const amountToReceive = Number(next.amountToReceive) || 0;
    if (amountToReceive > 0) {
      const chequeAmount = Number(next.chequeAmount) || 0;
      next = { ...next, amountHold: String(round2(amountToReceive - chequeAmount)) };
    }
  }

  return next;
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
    creditAmount: Number(form.creditAmount) || 0,
    creditGst: Number(form.creditGst) || 0,
    creditTotal: Number(form.creditTotal) || 0,
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
      { key: "gstAmount", label: "18% GST (Auto)", type: "number" },
      { key: "totalAmount", label: "Total Amount (Auto)", type: "number" }
    ]
  },
  {
    title: "Credit Note (Auto — Claimed minus Passed)",
    fields: [
      { key: "creditAmount", label: "Credit Amount (Auto)", type: "number" },
      { key: "creditGst", label: "GST on Credit (Auto)", type: "number" },
      { key: "creditTotal", label: "Credit Total (Auto)", type: "number" }
    ]
  },
  {
    title: "Payment Received",
    fields: [
      { key: "tds", label: "TDS", type: "number" },
      { key: "sdRetention", label: "SD / Retention Money", type: "number" },
      { key: "gstDeduction", label: "GST", type: "number" },
      { key: "amountToReceive", label: "Amount to be Received (Auto)", type: "number" },
      { key: "chequeAmount", label: "Chq. Amt", type: "number" },
      { key: "amountHold", label: "Amt Hold (Auto)", type: "number" },
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
