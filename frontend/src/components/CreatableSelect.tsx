import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadStoredOptions, mergeOptionLists, rememberOption } from "@/lib/tender-options";

const OTHER_VALUE = "__other__";

type CreatableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Seeded defaults (e.g. known bidders). */
  baseOptions?: string[];
  /** Values already used in saved records. */
  learnedOptions?: string[];
  /** localStorage key so "Other" entries persist for next time. */
  storageKey: string;
  placeholder?: string;
  otherPlaceholder?: string;
  className?: string;
  /**
   * When true (default), typing in Other updates the value on each keystroke.
   * Set false for auto-save forms so the value commits on blur only.
   */
  liveOther?: boolean;
};

export function CreatableSelect({
  value,
  onValueChange,
  baseOptions = [],
  learnedOptions = [],
  storageKey,
  placeholder = "Select",
  otherPlaceholder = "Enter name",
  className,
  liveOther = true,
}: CreatableSelectProps) {
  const [storedOptions, setStoredOptions] = useState(() => loadStoredOptions(storageKey));

  const options = useMemo(
    () => mergeOptionLists(baseOptions, learnedOptions, storedOptions),
    [baseOptions, learnedOptions, storedOptions]
  );

  const valueInOptions = Boolean(value && options.includes(value));
  const [isOther, setIsOther] = useState(() => Boolean(value) && !valueInOptions);
  const [otherDraft, setOtherDraft] = useState(value);

  useEffect(() => {
    const nextIsOther = Boolean(value) && !options.includes(value);
    setIsOther(nextIsOther);
    if (nextIsOther || !value) setOtherDraft(value);
  }, [value, options]);

  const selectValue = isOther ? OTHER_VALUE : value || undefined;

  const commitOther = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) {
      rememberOption(storageKey, trimmed);
      setStoredOptions(loadStoredOptions(storageKey));
    }
    if (trimmed !== value) onValueChange(trimmed);
    else if (raw !== value) onValueChange(trimmed);
  };

  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === OTHER_VALUE) {
            setIsOther(true);
            setOtherDraft(valueInOptions ? "" : value);
            if (valueInOptions) onValueChange("");
            return;
          }
          setIsOther(false);
          onValueChange(next);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_VALUE}>Other</SelectItem>
        </SelectContent>
      </Select>
      {isOther ? (
        <Input
          value={liveOther ? value : otherDraft}
          placeholder={otherPlaceholder}
          onChange={(e) => {
            if (liveOther) onValueChange(e.target.value);
            else setOtherDraft(e.target.value);
          }}
          onBlur={() => {
            commitOther(liveOther ? value : otherDraft);
          }}
        />
      ) : null}
    </div>
  );
}
