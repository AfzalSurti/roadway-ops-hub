import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wand2 } from "lucide-react";
import type { SubStaffPlanRow } from "@/lib/domain";

/**
 * The Construction/DLP phase-split planning table — balance, remaining time, suggested days and the
 * two editable Planned Days boxes. Shared by the Planning tab (one row per site per person) and the
 * Staff/Project profile popups (same columns, scoped down to one person or one project). Leaving a
 * Planned Days box untouched shows the computed Suggested Days as its value; clearing it and blurring
 * resets it back to that suggestion, while typing a number sticks as a manual override.
 */
export function SubStaffPlanTable({
  rows,
  firstColumnLabel,
  renderFirstColumn,
  onEditPlanDay
}: {
  rows: SubStaffPlanRow[];
  firstColumnLabel: string;
  renderFirstColumn: (row: SubStaffPlanRow) => ReactNode;
  onEditPlanDay: (assignmentId: string, field: "construction" | "dlp", value: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <table className="w-full text-xs min-w-[1400px]">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground">
            <th className="text-left p-2 font-medium">{firstColumnLabel}</th>
            <th className="text-left p-2 font-medium">Designation</th>
            <th className="text-right p-2 font-medium">Staff Balance MM (Constr.)</th>
            <th className="text-right p-2 font-medium">Staff Balance MM (DLP)</th>
            <th className="text-right p-2 font-medium">Project Remaining Months (Constr.)</th>
            <th className="text-right p-2 font-medium">Project Remaining Months (DLP)</th>
            <th className="text-right p-2 font-medium">Constr. Suggested Days</th>
            <th className="text-right p-2 font-medium">DLP Suggested Days</th>
            <th className="text-right p-2 font-medium w-28">Contract Planned Days</th>
            <th className="text-right p-2 font-medium w-28">DLP Planned Days</th>
            <th className="text-left p-2 font-medium">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const completed = row.metrics.remainingConsMonths <= 0 && row.metrics.remainingDlpMonths <= 0;
            const consValue = row.plannedDaysConstruction || row.metrics.suggestedDaysConstruction;
            const dlpValue = row.plannedDaysDlp || row.metrics.suggestedDaysDlp;
            return (
              <tr key={row.assignment.id} className="border-b border-border/10 last:border-0">
                <td className="p-2">
                  {renderFirstColumn(row)}
                  {completed ? (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      Completed
                    </Badge>
                  ) : null}
                </td>
                <td className="p-2">{row.assignment.designation || "—"}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.staffBalanceMmConstruction.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.staffBalanceMmDlp.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.remainingConsMonths.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.remainingDlpMonths.toFixed(2)}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.suggestedDaysConstruction.toFixed(1)}</td>
                <td className="p-2 text-right tabular-nums">{row.metrics.suggestedDaysDlp.toFixed(1)}</td>
                <td className="p-2 text-right">
                  <Input
                    type="number"
                    min="0"
                    max="31"
                    step="0.5"
                    defaultValue={consValue ? Number(consValue.toFixed(1)) : ""}
                    key={`${row.assignment.id}-cons-${row.plannedDaysConstruction}`}
                    className="h-7 w-20 text-right text-xs ml-auto"
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const next = raw === "" ? row.metrics.suggestedDaysConstruction : Number(raw) || 0;
                      if (next !== row.plannedDaysConstruction) onEditPlanDay(row.assignment.id, "construction", next);
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  <Input
                    type="number"
                    min="0"
                    max="31"
                    step="0.5"
                    defaultValue={dlpValue ? Number(dlpValue.toFixed(1)) : ""}
                    key={`${row.assignment.id}-dlp-${row.plannedDaysDlp}`}
                    className="h-7 w-20 text-right text-xs ml-auto"
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const next = raw === "" ? row.metrics.suggestedDaysDlp : Number(raw) || 0;
                      if (next !== row.plannedDaysDlp) onEditPlanDay(row.assignment.id, "dlp", next);
                    }}
                  />
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Fill both Planned Days boxes with the computed Suggested Days"
                    onClick={() => {
                      onEditPlanDay(row.assignment.id, "construction", row.metrics.suggestedDaysConstruction);
                      onEditPlanDay(row.assignment.id, "dlp", row.metrics.suggestedDaysDlp);
                    }}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Use Suggested
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
