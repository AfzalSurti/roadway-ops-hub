import type { ProjectFinancialDetailsForm } from "@/lib/project-financial-details";
import {
  computePairTotal,
  formatDateDisplay,
  formatMoneyDisplay,
  sanitizeMoneyInput
} from "@/lib/project-financial-details";

type ProjectFinancialDetailsFieldsProps = {
  form: ProjectFinancialDetailsForm;
  isEditing: boolean;
  onChange: (patch: Partial<ProjectFinancialDetailsForm>) => void;
};

function MoneyField({
  label,
  value,
  isEditing,
  onChange,
  readOnly = false
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isEditing ? (
        <input
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange?.(sanitizeMoneyInput(event.target.value))}
          inputMode="decimal"
          placeholder="0.00"
          className={`w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50 ${readOnly ? "opacity-80 cursor-not-allowed" : ""}`}
          title={label}
        />
      ) : (
        <p className="font-medium mt-1 tabular-nums">{formatMoneyDisplay(value)}</p>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  isEditing,
  onChange
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isEditing ? (
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
          title={label}
        />
      ) : (
        <p className="font-medium mt-1">{formatDateDisplay(value)}</p>
      )}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="sm:col-span-2 pt-2">
      <p className="text-sm font-semibold text-primary">{title}</p>
    </div>
  );
}

export function ProjectFinancialDetailsFields({ form, isEditing, onChange }: ProjectFinancialDetailsFieldsProps) {
  const updateWo = (patch: Partial<ProjectFinancialDetailsForm>) => {
    const next = { ...form, ...patch };
    onChange({
      ...patch,
      woTotalAmount: computePairTotal(next.woAmount, next.woGstAmount) || next.woTotalAmount
    });
  };

  const updateExcess = (patch: Partial<ProjectFinancialDetailsForm>) => {
    const next = { ...form, ...patch };
    onChange({
      ...patch,
      excessTotalAmount: computePairTotal(next.excessAmount, next.excessGstAmount) || next.excessTotalAmount
    });
  };

  return (
    <>
      <SectionHeading title="Work Order (WO)" />
      <MoneyField
        label="WO Amount"
        value={form.woAmount}
        isEditing={isEditing}
        onChange={(value) => updateWo({ woAmount: value })}
      />
      <MoneyField
        label="GST"
        value={form.woGstAmount}
        isEditing={isEditing}
        onChange={(value) => updateWo({ woGstAmount: value })}
      />
      <MoneyField
        label="Total Amount"
        value={form.woTotalAmount}
        isEditing={isEditing}
        readOnly
        onChange={(value) => updateWo({ woTotalAmount: value })}
      />

      <SectionHeading title="Excess / Extra" />
      <MoneyField
        label="Excess/Extra Amount"
        value={form.excessAmount}
        isEditing={isEditing}
        onChange={(value) => updateExcess({ excessAmount: value })}
      />
      <MoneyField
        label="GST for Excess/Extra"
        value={form.excessGstAmount}
        isEditing={isEditing}
        onChange={(value) => updateExcess({ excessGstAmount: value })}
      />
      <MoneyField
        label="Total Amount"
        value={form.excessTotalAmount}
        isEditing={isEditing}
        readOnly
        onChange={(value) => updateExcess({ excessTotalAmount: value })}
      />

      <SectionHeading title="Bank Guarantee (BG)" />
      <MoneyField
        label="BG Amount"
        value={form.bgAmount}
        isEditing={isEditing}
        onChange={(value) => onChange({ bgAmount: value })}
      />
      <DateField
        label="Date of Issue"
        value={form.bgIssueDate}
        isEditing={isEditing}
        onChange={(value) => onChange({ bgIssueDate: value })}
      />
      <DateField
        label="Date of Expiry"
        value={form.bgExpiryDate}
        isEditing={isEditing}
        onChange={(value) => onChange({ bgExpiryDate: value })}
      />

      <SectionHeading title="EMD" />
      <MoneyField
        label="EMD Amount"
        value={form.emdAmount}
        isEditing={isEditing}
        onChange={(value) => onChange({ emdAmount: value })}
      />
      <DateField
        label="Date of Issue"
        value={form.emdIssueDate}
        isEditing={isEditing}
        onChange={(value) => onChange({ emdIssueDate: value })}
      />
      <DateField
        label="Date of Expiry"
        value={form.emdExpiryDate}
        isEditing={isEditing}
        onChange={(value) => onChange({ emdExpiryDate: value })}
      />
    </>
  );
}
