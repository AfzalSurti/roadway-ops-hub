import { getHodTaskActivityLabel, shouldShowHodActivityDate, type HodTaskActivityStatus } from "@/lib/hod-dashboard";

type HodActivityStatusDisplayProps = {
  status: HodTaskActivityStatus;
  label?: string;
  date?: string | null;
  className?: string;
  labelClassName?: string;
  dateClassName?: string;
};

export function HodActivityStatusDisplay({
  status,
  label,
  date,
  className = "flex flex-col items-center justify-center gap-0.5",
  labelClassName = "font-semibold leading-tight",
  dateClassName = "text-[9px] opacity-90"
}: HodActivityStatusDisplayProps) {
  const statusLabel = label ?? getHodTaskActivityLabel(status);
  const showDate = shouldShowHodActivityDate(status, date);

  return (
    <div className={className}>
      <span className={labelClassName}>{statusLabel}</span>
      {showDate ? <span className={dateClassName}>{date}</span> : null}
    </div>
  );
}
