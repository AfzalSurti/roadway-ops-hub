import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wand2 } from "lucide-react";
import type { SubStaffPlanRow } from "@/lib/domain";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

// Mirrors the backend's own FULL_TIME_DESIGNATIONS list (sub-staff.service.ts) — kept in sync by hand
// since these are a fixed, rarely-changing set of back-office roles, not a live-fetched catalog.
const FULL_TIME_DESIGNATIONS = new Set(["office manager", "accountant", "accountant cum cashier"]);
function isFullTimeDesignation(designation: string) {
  return FULL_TIME_DESIGNATIONS.has(designation.trim().toLowerCase());
}

function splitByShare(allocated: number, metrics: SubStaffPlanRow["metrics"]) {
  const suggestedTotal = metrics.suggestedDaysConstruction + metrics.suggestedDaysDlp;
  const consShare = suggestedTotal > 0 ? metrics.suggestedDaysConstruction / suggestedTotal : 0;
  const plannedDaysConstruction = Math.round(allocated * consShare * 10) / 10;
  const plannedDaysDlp = Math.round((allocated - plannedDaysConstruction) * 10) / 10;
  return { plannedDaysConstruction, plannedDaysDlp };
}

type Allocation = { assignmentId: string; plannedDaysConstruction: number; plannedDaysDlp: number };

/** Mirrors the server's generatePlan budget split exactly, so the "Use Suggested" button can never push
 * a person's total above the real 30-day/month cap: full-time back-office roles each get their own full
 * days (they aren't shared/capped), the rest share one 30-day pool, soonest-ending (then highest-rate)
 * assignments first. Only valid when every row in `rows` belongs to the same person. */
function computeBalancedAllocation(rows: SubStaffPlanRow[]): Allocation[] {
  const results: Allocation[] = [];

  for (const row of rows.filter((r) => isFullTimeDesignation(r.assignment.designation))) {
    const allocated = row.metrics.totalRemainingMonths > 0 ? Math.min(row.metrics.suggestedDaysPerMonth, 30) : 0;
    results.push({ assignmentId: row.assignment.id, ...splitByShare(allocated, row.metrics) });
  }

  const shared = rows
    .filter((r) => !isFullTimeDesignation(r.assignment.designation))
    .filter((r) => r.metrics.totalRemainingMonths > 0 && r.metrics.suggestedDaysPerMonth > 0)
    .sort((a, b) => {
      if (a.metrics.totalRemainingMonths !== b.metrics.totalRemainingMonths) {
        return a.metrics.totalRemainingMonths - b.metrics.totalRemainingMonths;
      }
      return b.assignment.rate - a.assignment.rate;
    });

  let budget = 30;
  for (const row of shared) {
    const ideal = Math.min(row.metrics.suggestedDaysPerMonth, 30);
    const allocated = Math.max(0, Math.min(ideal, budget));
    budget = Math.max(0, budget - allocated);
    results.push({ assignmentId: row.assignment.id, ...splitByShare(allocated, row.metrics) });
  }

  // Anything not covered above gets zeroed, so the button is a full, consistent reset of these rows.
  for (const row of rows) {
    if (results.some((r) => r.assignmentId === row.assignment.id)) continue;
    results.push({ assignmentId: row.assignment.id, plannedDaysConstruction: 0, plannedDaysDlp: 0 });
  }

  return results;
}

/**
 * The Construction/DLP phase-split planning table — balance, remaining time, suggested days and the
 * two editable Planned Days boxes. Shared by the Planning tab (one row per site per person) and the
 * Staff/Project profile popups. Typing a number sticks as a manual override; the boxes otherwise show
 * whatever's actually saved (0/blank if nothing's been planned yet) — never a not-yet-saved guess.
 */
export function SubStaffPlanTable({
  rows,
  firstColumnLabel,
  renderFirstColumn,
  onEditPlanDay,
  onConfirmPlanDay,
  onFindOpenPositions,
  budgetScope
}: {
  rows: SubStaffPlanRow[];
  firstColumnLabel: string;
  renderFirstColumn: (row: SubStaffPlanRow) => ReactNode;
  onEditPlanDay: (assignmentId: string, field: "construction" | "dlp", value: number) => void;
  /** Ticking "Confirmed" locks this row's current numbers so a later Generate/Refresh never silently
   * rewrites them — optional since the read-only history views don't need it. */
  onConfirmPlanDay?: (assignmentId: string, confirmed: boolean) => void;
  /** Shown as a small action once a row is Completed, to look for an unfilled ("TO BE NAME") slot in the
   * same designation this person could move into next — optional for the same reason. */
  onFindOpenPositions?: (assignmentId: string) => void;
  /** "person": every row here belongs to the same person, so one "Use Suggested" button can safely
   * rebalance all of them against one real 30-day/month cap. "independent": each row is a different
   * person (e.g. all staff on one project) — there's no safe shared cap to compute here, so each row
   * gets its own small action that just copies that row's own Suggested Days, uncapped. */
  budgetScope: "person" | "independent";
}) {
  const applyBalanced = () => {
    for (const { assignmentId, plannedDaysConstruction, plannedDaysDlp } of computeBalancedAllocation(rows)) {
      onEditPlanDay(assignmentId, "construction", plannedDaysConstruction);
      onEditPlanDay(assignmentId, "dlp", plannedDaysDlp);
    }
  };

  return (
    <div className="space-y-2">
      {budgetScope === "person" ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={applyBalanced}>
            <Wand2 className="h-3.5 w-3.5" />
            Use Suggested (fits this person's 30-day month)
          </Button>
        </div>
      ) : null}
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
              <th className="text-right p-2 font-medium">Potential Loss</th>
              <th className="text-right p-2 font-medium w-28">Construction Planned Days</th>
              <th className="text-right p-2 font-medium w-28">DLP Planned Days</th>
              {onConfirmPlanDay ? <th className="text-center p-2 font-medium">Confirmed</th> : null}
              {budgetScope === "independent" ? <th className="text-left p-2 font-medium">&nbsp;</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const completed = row.metrics.remainingConsMonths <= 0 && row.metrics.remainingDlpMonths <= 0;
              const totalPlanned = row.plannedDaysConstruction + row.plannedDaysDlp;
              const budgetUsedElsewhere =
                !completed && row.autoPlanned && row.metrics.suggestedDaysPerMonth > 0 && totalPlanned === 0;
              return (
                <tr key={row.assignment.id} className="border-b border-border/10 last:border-0">
                  <td className="p-2">
                    {renderFirstColumn(row)}
                    {completed ? (
                      <Badge variant="secondary" className="ml-2 align-middle">
                        Completed
                      </Badge>
                    ) : null}
                    {completed && onFindOpenPositions ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 h-6 px-1.5 ml-1 text-[11px] text-muted-foreground hover:text-foreground"
                        title="Find an unfilled position in the same designation this person could move into"
                        onClick={() => onFindOpenPositions(row.assignment.id)}
                      >
                        <Search className="h-3 w-3" />
                        Find open positions
                      </Button>
                    ) : null}
                    {budgetUsedElsewhere ? (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Budget used by another project this month
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2">{row.assignment.designation || "—"}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.staffBalanceMmConstruction.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.staffBalanceMmDlp.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.remainingConsMonths.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.remainingDlpMonths.toFixed(2)}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.suggestedDaysConstruction.toFixed(1)}</td>
                  <td className="p-2 text-right tabular-nums">{row.metrics.suggestedDaysDlp.toFixed(1)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {(() => {
                      const loss = row.metrics.lossAmountConstruction + row.metrics.lossAmountDlp;
                      const lossMm = row.metrics.lossMmConstruction + row.metrics.lossMmDlp;
                      return loss > 0 ? (
                        <Badge variant="destructive" className="whitespace-nowrap">
                          {lossMm.toFixed(2)} MM · ₹{money(loss)}
                        </Badge>
                      ) : (
                        "—"
                      );
                    })()}
                  </td>
                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      max="31"
                      step="0.5"
                      defaultValue={row.plannedDaysConstruction || ""}
                      key={`${row.assignment.id}-cons-${row.plannedDaysConstruction}`}
                      className="h-7 w-20 text-right text-xs ml-auto"
                      onBlur={(e) => {
                        const next = Number(e.target.value) || 0;
                        if (next !== row.plannedDaysConstruction) {
                          onEditPlanDay(row.assignment.id, "construction", next);
                        }
                      }}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      max="31"
                      step="0.5"
                      defaultValue={row.plannedDaysDlp || ""}
                      key={`${row.assignment.id}-dlp-${row.plannedDaysDlp}`}
                      className="h-7 w-20 text-right text-xs ml-auto"
                      onBlur={(e) => {
                        const next = Number(e.target.value) || 0;
                        if (next !== row.plannedDaysDlp) onEditPlanDay(row.assignment.id, "dlp", next);
                      }}
                    />
                  </td>
                  {onConfirmPlanDay ? (
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!row.autoPlanned}
                        onChange={(e) => onConfirmPlanDay(row.assignment.id, e.target.checked)}
                        title="Lock this row so Generate/Refresh never rewrites it"
                        className="h-4 w-4"
                      />
                    </td>
                  ) : null}
                  {budgetScope === "independent" ? (
                    <td className="p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        title="Copies this row's own Suggested Days — not checked against this person's other projects"
                        onClick={() => {
                          onEditPlanDay(row.assignment.id, "construction", row.metrics.suggestedDaysConstruction);
                          onEditPlanDay(row.assignment.id, "dlp", row.metrics.suggestedDaysDlp);
                        }}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Use Suggested
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
