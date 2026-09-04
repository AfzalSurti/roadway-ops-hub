import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { HoursAdminRequestItem, HoursRequestStatus, LeaveRequestItem, LeaveType, OvertimeRequestItem } from "@/lib/domain";
import { exportHoursReportPdf } from "@/lib/hours-report-pdf";
import { formatDisplayDate, leaveTypeLabel, statusBadgeVariant, statusLabel } from "@/lib/hours-format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

const COVERAGE_STYLES: Record<string, string> = {
  Covered: "text-emerald-600",
  "Partially Covered": "text-amber-600",
  "Not Covered": "text-red-500",
  Extra: "text-sky-600"
};

export default function EmployeeOvertime() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: "LEAVE" | "OVERTIME" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [filters, setFilters] = useState({
    employeeId: "",
    periodId: "",
    leaveType: "",
    requestType: "",
    status: "PENDING",
    dateFrom: "",
    dateTo: ""
  });

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const employees = useMemo(() => users.filter((user) => user.role === "EMPLOYEE"), [users]);

  const { data: periods = [] } = useQuery({
    queryKey: ["hours-periods"],
    queryFn: () => api.getHoursPeriods()
  });

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) setSelectedEmployeeId(employees[0].id);
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (!selectedPeriodId && periods.length > 0) {
      const active = periods.find((period) => period.status === "ACTIVE");
      setSelectedPeriodId(active?.id ?? periods[0].id);
    }
  }, [periods, selectedPeriodId]);

  const {
    data: report,
    isLoading: loadingReport,
    isFetching: fetchingReport
  } = useQuery({
    queryKey: ["hours-employee-report", selectedEmployeeId, selectedPeriodId],
    queryFn: () => api.getEmployeeHoursReport(selectedEmployeeId, selectedPeriodId || undefined),
    enabled: Boolean(selectedEmployeeId)
  });

  useEffect(() => {
    if (report) void queryClient.invalidateQueries({ queryKey: ["hours-periods"] });
    // Only re-run when the report identity changes — invalidating periods is a one-shot side effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.period.id]);

  const {
    data: requests = [],
    isLoading: loadingRequests
  } = useQuery({
    queryKey: ["hours-admin-requests", filters],
    queryFn: () =>
      api.getAdminHoursRequests({
        employeeId: filters.employeeId || undefined,
        periodId: filters.periodId || undefined,
        leaveType: (filters.leaveType || undefined) as LeaveType | undefined,
        requestType: (filters.requestType || undefined) as "LEAVE" | "OVERTIME" | undefined,
        status: (filters.status || undefined) as HoursRequestStatus | undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined
      })
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hours-admin-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["hours-employee-report"] })
    ]);
  };

  const approveMutation = useMutation({
    mutationFn: (request: HoursAdminRequestItem): Promise<LeaveRequestItem | OvertimeRequestItem> =>
      request.requestType === "LEAVE" ? api.approveLeaveRequest(request.id) : api.approveOvertimeRequest(request.id),
    onSuccess: async () => {
      toast.success("Approved");
      await refreshAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to approve")
  });

  const rejectMutation = useMutation({
    mutationFn: (): Promise<LeaveRequestItem | OvertimeRequestItem> => {
      if (!rejectTarget) throw new Error("No request selected");
      return rejectTarget.type === "LEAVE"
        ? api.rejectLeaveRequest(rejectTarget.id, rejectReason.trim() || undefined)
        : api.rejectOvertimeRequest(rejectTarget.id, rejectReason.trim() || undefined);
    },
    onSuccess: async () => {
      toast.success("Rejected");
      setRejectTarget(null);
      setRejectReason("");
      await refreshAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to reject")
  });

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  const breakdownRows = useMemo(() => {
    if (!report) return [];
    const leaveHasAllocation = new Set(report.allocations.map((allocation) => allocation.leaveId));
    const leaveById = new Map(report.leaveBreakdown.map((row) => [row.id, row]));

    type Row = {
      key: string;
      leaveDate?: string;
      leaveLabel?: string;
      leaveHours?: string;
      overtimeDate?: string;
      overtimeHours?: string;
      coverage: string;
    };
    const rows: Row[] = [];

    report.allocations.forEach((allocation, index) => {
      const leave = leaveById.get(allocation.leaveId);
      rows.push({
        key: `alloc-${index}`,
        leaveDate: allocation.leaveDate,
        leaveLabel: leaveTypeLabel(allocation.leaveType),
        leaveHours: leave?.durationLabel,
        overtimeDate: allocation.overtimeDate,
        overtimeHours: allocation.minutesAppliedLabel,
        coverage: leave?.coverageStatus === "COVERED" ? "Covered" : "Partially Covered"
      });
    });

    report.leaveBreakdown
      .filter((leave) => !leaveHasAllocation.has(leave.id))
      .forEach((leave) => {
        rows.push({
          key: `leave-${leave.id}`,
          leaveDate: leave.date,
          leaveLabel: leaveTypeLabel(leave.leaveType),
          leaveHours: leave.durationLabel,
          coverage: "Not Covered"
        });
      });

    report.overtimeBreakdown
      .filter((overtime) => overtime.extraMinutes > 0)
      .forEach((overtime) => {
        rows.push({
          key: `extra-${overtime.id}`,
          overtimeDate: overtime.date,
          overtimeHours: overtime.extraLabel,
          coverage: "Extra"
        });
      });

    return rows.sort(
      (a, b) =>
        new Date(a.leaveDate ?? a.overtimeDate ?? 0).getTime() - new Date(b.leaveDate ?? b.overtimeDate ?? 0).getTime()
    );
  }, [report]);

  const clearFilters = () =>
    setFilters({ employeeId: "", periodId: "", leaveType: "", requestType: "", status: "PENDING", dateFrom: "", dateTo: "" });
  const hasFilters =
    filters.employeeId || filters.periodId || filters.leaveType || filters.requestType || filters.dateFrom || filters.dateTo || filters.status !== "PENDING";

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Employee Overtime</h1>
        <p className="page-subtitle">Leave and overtime requests, approvals, and per-employee hour calculations.</p>
      </div>

      <div className="glass-panel p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Employee</Label>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Calculation Period</Label>
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
                  {period.status === "ACTIVE" ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingReport || fetchingReport ? (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading summary...
        </p>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Full Day Leave", value: String(report.leave.fullDay.count) },
              { label: "Half Day Leave", value: String(report.leave.halfDay.count) },
              { label: "Short Leave", value: String(report.leave.shortLeave.count) },
              { label: "Total Leave Hours", value: report.leave.totalLabel },
              { label: "Approved Overtime", value: report.approvedOvertimeLabel },
              { label: "Remaining", value: report.remainingLabel },
              { label: "Pending Requests", value: String(report.pendingCount) }
            ].map((card) => (
              <div key={card.label} className="glass-panel p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">
                {selectedEmployee?.name} — Leave Summary
              </h2>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => exportHoursReportPdf(report, selectedEmployee?.name ?? "Employee")}
              >
                <Download className="h-3.5 w-3.5" /> Export PDF
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="py-2 pr-3 text-left font-medium">Category</th>
                    <th className="py-2 px-3 text-right font-medium">Count</th>
                    <th className="py-2 pl-3 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">Full Day Leave</td>
                    <td className="py-2 px-3 text-right">{report.leave.fullDay.count}</td>
                    <td className="py-2 pl-3 text-right">{report.leave.fullDay.label}</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">Half Day Leave</td>
                    <td className="py-2 px-3 text-right">{report.leave.halfDay.count}</td>
                    <td className="py-2 pl-3 text-right">{report.leave.halfDay.label}</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">Short Leave</td>
                    <td className="py-2 px-3 text-right">{report.leave.shortLeave.count}</td>
                    <td className="py-2 pl-3 text-right">{report.leave.shortLeave.label}</td>
                  </tr>
                  <tr className="border-b border-border/20 font-semibold">
                    <td className="py-2 pr-3">Total Leave</td>
                    <td className="py-2 px-3 text-right">{report.leave.totalCount}</td>
                    <td className="py-2 pl-3 text-right">{report.leave.totalLabel}</td>
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="py-2 pr-3">Approved Overtime</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 pl-3 text-right">{report.approvedOvertimeLabel}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 pr-3">Remaining</td>
                    <td className="py-2 px-3 text-right">—</td>
                    <td className="py-2 pl-3 text-right">{report.remainingLabel}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-lg font-semibold">Date-wise Breakdown</h2>
            {breakdownRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No approved leave or overtime in this period yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead>
                    <tr className="bg-secondary/40 text-muted-foreground">
                      <th className="p-2 text-left font-medium">Leave Date</th>
                      <th className="p-2 text-left font-medium">Leave</th>
                      <th className="p-2 text-left font-medium">Leave Hours</th>
                      <th className="p-2 text-left font-medium">Overtime Date</th>
                      <th className="p-2 text-left font-medium">Overtime Hours</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map((row) => (
                      <tr key={row.key} className="border-t border-border/20">
                        <td className="p-2">{row.leaveDate ? formatDisplayDate(row.leaveDate) : "—"}</td>
                        <td className="p-2">{row.leaveLabel ?? "—"}</td>
                        <td className="p-2">{row.leaveHours ?? "—"}</td>
                        <td className="p-2">{row.overtimeDate ? formatDisplayDate(row.overtimeDate) : "—"}</td>
                        <td className="p-2">{row.overtimeHours ?? "—"}</td>
                        <td className="p-2">Approved</td>
                        <td className={`p-2 font-medium ${COVERAGE_STYLES[row.coverage] ?? ""}`}>{row.coverage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground p-4">Select an employee to view their hours summary.</p>
      )}

      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Requests</h2>
          {hasFilters ? (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          <Select value={filters.employeeId || "ALL"} onValueChange={(v) => setFilters((p) => ({ ...p, employeeId: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Employees</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.periodId || "ALL"} onValueChange={(v) => setFilters((p) => ({ ...p, periodId: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Periods</SelectItem>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.leaveType || "ALL"} onValueChange={(v) => setFilters((p) => ({ ...p, leaveType: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Leave Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Leave Types</SelectItem>
              <SelectItem value="FULL_DAY">Full Day</SelectItem>
              <SelectItem value="HALF_DAY">Half Day</SelectItem>
              <SelectItem value="SHORT_LEAVE">Short Leave</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.requestType || "ALL"} onValueChange={(v) => setFilters((p) => ({ ...p, requestType: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Request Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Leave + Overtime</SelectItem>
              <SelectItem value="LEAVE">Leave</SelectItem>
              <SelectItem value="OVERTIME">Overtime</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status || "ALL"} onValueChange={(v) => setFilters((p) => ({ ...p, status: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="h-8 text-xs"
            value={filters.dateFrom}
            onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
          />
          <Input
            type="date"
            className="h-8 text-xs"
            value={filters.dateTo}
            onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Employee</th>
                <th className="py-2 px-3 text-left font-medium">Date</th>
                <th className="py-2 px-3 text-left font-medium">Type</th>
                <th className="py-2 px-3 text-right font-medium">Hours</th>
                <th className="py-2 px-3 text-left font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingRequests ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading requests...
                    </span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No requests match the filters.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={`${request.requestType}-${request.id}`} className="border-b border-border/20">
                    <td className="py-2 pr-3">{request.employee.name}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{formatDisplayDate(request.date)}</td>
                    <td className="py-2 px-3">
                      {request.requestType === "LEAVE" ? leaveTypeLabel(request.leaveType) : "Overtime"}
                    </td>
                    <td className="py-2 px-3 text-right">{request.durationLabel}</td>
                    <td className="py-2 px-3">
                      <Badge variant={statusBadgeVariant(request.status)}>{statusLabel(request.status)}</Badge>
                      {request.status === "REJECTED" && request.rejectionReason ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{request.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      {request.status === "PENDING" ? (
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(request)}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-[11px] text-destructive"
                            onClick={() => setRejectTarget({ id: request.id, type: request.requestType })}
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>Optionally add a reason — the employee will see it.</DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
