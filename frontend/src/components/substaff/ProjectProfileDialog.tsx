import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { SubStaffAssignment } from "@/lib/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, UserCog } from "lucide-react";
import { downloadProjectStaffReport } from "@/lib/sub-staff-pdf";
import { buildMonthlyBreakdown, type MonthlyBreakdownMonth } from "@/lib/sub-staff-timeline";
import { ReplaceStaffDialog } from "@/components/substaff/ReplaceStaffDialog";
import { SubStaffPlanTable } from "@/components/substaff/SubStaffPlanTable";
import type { ProjectOption } from "@/components/substaff/SubStaffFormFields";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const monthlyChartConfig = { totalDays: { label: "Planned Days", color: "hsl(220 60% 55%)" } };

function MonthTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyBreakdownMonth }> }) {
  if (!active || !payload?.length) return null;
  const month = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-md max-w-[280px]">
      <p className="font-semibold mb-1">
        {month.label} — {month.totalDays.toFixed(1)} day(s)
      </p>
      <ul className="space-y-0.5 max-h-40 overflow-auto">
        {month.entries.map((e, i) => (
          <li key={i}>
            {e.staffName} ({e.designation || "—"}) — {e.plannedDays.toFixed(1)}d
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every staff member on one project, Active and Left — opened by clicking a project name anywhere. */
export function ProjectProfileDialog({
  projectName,
  onClose,
  designationFilter = "",
  staffNameFilter = "",
  designationOptions,
  staffNameOptions,
  projectOptions
}: {
  projectName: string | null;
  onClose: () => void;
  /** Mirrors the Data Entry / Planning page filters, so the month-by-month breakdown below reflects
   * what the user was already looking at, not every record on the project. */
  designationFilter?: string;
  staffNameFilter?: string;
  designationOptions: string[];
  staffNameOptions: string[];
  projectOptions: ProjectOption[];
}) {
  const queryClient = useQueryClient();
  const [replacingAssignment, setReplacingAssignment] = useState<SubStaffAssignment | null>(null);
  const now = new Date();
  const [planYear, setPlanYear] = useState(now.getFullYear());
  const [planMonth, setPlanMonth] = useState(now.getMonth() + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 1 + i);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sub-staff-project-profile", projectName],
    queryFn: () => api.getSubStaffAssignments({ siteName: projectName ?? undefined }),
    enabled: Boolean(projectName)
  });

  const { data: planRows = [], isLoading: loadingPlan } = useQuery({
    queryKey: ["sub-staff-plan", planYear, planMonth],
    queryFn: () => api.getSubStaffPlan(planYear, planMonth),
    enabled: Boolean(projectName)
  });

  const setPlanDayMutation = useMutation({
    mutationFn: ({ assignmentId, field, value }: { assignmentId: string; field: "construction" | "dlp"; value: number }) =>
      api.setSubStaffPlanDay(assignmentId, planYear, planMonth, field, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sub-staff-plan", planYear, planMonth] })
  });

  const normalized = projectName?.trim().toLowerCase();
  const matches = rows.filter((r) => r.siteName.trim().toLowerCase() === normalized);
  const totalMm = matches.reduce((s, r) => s + r.totalMm, 0);
  const usedMm = matches.reduce((s, r) => s + r.usedMm, 0);

  const filteredMatches = useMemo(() => {
    const designationQ = designationFilter.trim().toLowerCase();
    const staffQ = staffNameFilter.trim().toLowerCase();
    return matches.filter(
      (r) =>
        (!designationQ || r.designation.toLowerCase().includes(designationQ)) &&
        (!staffQ || r.staffName.toLowerCase().includes(staffQ))
    );
  }, [matches, designationFilter, staffNameFilter]);

  const monthly = useMemo(() => buildMonthlyBreakdown(filteredMatches), [filteredMatches]);
  const filtersActive = Boolean(designationFilter.trim() || staffNameFilter.trim());

  const thisMonthRows = useMemo(() => {
    const designationQ = designationFilter.trim().toLowerCase();
    const staffQ = staffNameFilter.trim().toLowerCase();
    return planRows.filter(
      (r) =>
        r.assignment.siteName.trim().toLowerCase() === normalized &&
        (!designationQ || r.assignment.designation.toLowerCase().includes(designationQ)) &&
        (!staffQ || r.assignment.staffName.toLowerCase().includes(staffQ))
    );
  }, [planRows, normalized, designationFilter, staffNameFilter]);

  return (
    <>
    <Dialog open={Boolean(projectName)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{projectName}</DialogTitle>
          <DialogDescription>
            {matches.length} staff record(s) on this project — Total MM {totalMm.toFixed(2)} · Used{" "}
            {usedMm.toFixed(2)} · Balance {(totalMm - usedMm).toFixed(2)}
            {filtersActive ? " · breakdown below matches your current page filters" : null}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No staff records found for this project.</p>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-xs min-w-[920px]">
                <thead>
                  <tr className="bg-secondary/30 text-muted-foreground">
                    <th className="p-2 text-left font-medium">Staff Name</th>
                    <th className="p-2 text-left font-medium">Designation</th>
                    <th className="p-2 text-left font-medium">Co-Ordinator</th>
                    <th className="p-2 text-right font-medium">Rate</th>
                    <th className="p-2 text-right font-medium">Total MM</th>
                    <th className="p-2 text-right font-medium">Used MM</th>
                    <th className="p-2 text-right font-medium">Staff Balance MM</th>
                    <th className="p-2 text-left font-medium">Start</th>
                    <th className="p-2 text-left font-medium">End</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((entry) => (
                    <tr key={entry.id} className="border-t border-border/20">
                      <td className="p-2 font-medium">{entry.staffName}</td>
                      <td className="p-2">{entry.designation || "—"}</td>
                      <td className="p-2">{entry.coOrdinator || "—"}</td>
                      <td className="p-2 text-right tabular-nums">{money(entry.rate)}</td>
                      <td className="p-2 text-right tabular-nums">{entry.totalMm.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums">{entry.usedMm.toFixed(2)}</td>
                      <td className="p-2 text-right tabular-nums font-medium">
                        {(entry.totalMm - entry.usedMm).toFixed(2)}
                      </td>
                      <td className="p-2 whitespace-nowrap">{formatDate(entry.startDate)}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(entry.endDate)}</td>
                      <td className="p-2">
                        <Badge variant={entry.status === "ACTIVE" ? "secondary" : "outline"}>{entry.status}</Badge>
                      </td>
                      <td className="p-2">
                        {entry.status === "ACTIVE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1 h-7 text-xs"
                            onClick={() => setReplacingAssignment(entry)}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            Replace
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">This month's plan — Contract &amp; DLP planned days</h4>
                <div className="flex gap-2">
                  <Select value={String(planMonth)} onValueChange={(v) => setPlanMonth(Number(v))}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(planYear)} onValueChange={(v) => setPlanYear(Number(v))}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {loadingPlan ? (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading plan...
                </p>
              ) : thisMonthRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/40 rounded-xl">
                  No active assignments on this project for this month{filtersActive ? " (under the current filters)" : ""}.
                </p>
              ) : (
                <SubStaffPlanTable
                  rows={thisMonthRows}
                  firstColumnLabel="Staff Name"
                  renderFirstColumn={(row) => row.assignment.staffName}
                  onEditPlanDay={(assignmentId, field, value) => setPlanDayMutation.mutate({ assignmentId, field, value })}
                />
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Month-by-month work breakdown</h4>
              {monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border/40 rounded-xl">
                  No planned-days data yet for this project{filtersActive ? " (under the current filters)" : ""} —
                  generate a plan on the Planning tab to populate this.
                </p>
              ) : (
                <>
                  <ChartContainer config={monthlyChartConfig} className="h-[260px] w-full aspect-auto">
                    <BarChart data={monthly} margin={{ top: 8, right: 12, left: 8, bottom: 32 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" />
                      <XAxis
                        dataKey="label"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={56}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={40} />
                      <Tooltip content={<MonthTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                      <Bar dataKey="totalDays" fill="var(--color-totalDays)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ChartContainer>

                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="bg-secondary/30 text-muted-foreground">
                          <th className="p-2 text-left font-medium w-32">Month</th>
                          <th className="p-2 text-left font-medium">Staff Name</th>
                          <th className="p-2 text-left font-medium">Designation</th>
                          <th className="p-2 text-right font-medium">Planned Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.map((month) =>
                          month.entries.map((entry, i) => (
                            <tr key={`${month.key}-${entry.staffName}-${i}`} className="border-t border-border/20">
                              {i === 0 ? (
                                <td className="p-2 font-medium align-top" rowSpan={month.entries.length}>
                                  {month.label}
                                </td>
                              ) : null}
                              <td className="p-2">{entry.staffName}</td>
                              <td className="p-2">{entry.designation || "—"}</td>
                              <td className="p-2 text-right tabular-nums">{entry.plannedDays.toFixed(1)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={matches.length === 0}
            onClick={() => projectName && downloadProjectStaffReport(projectName, matches)}
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ReplaceStaffDialog
      assignment={replacingAssignment}
      onClose={() => setReplacingAssignment(null)}
      designationOptions={designationOptions}
      staffNameOptions={staffNameOptions}
      projectOptions={projectOptions}
    />
    </>
  );
}
