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
import { exportAllEmployeesHoursReportPdf } from "@/lib/hours-report-pdf";
import {
  buildBreakdownRows,
  formatDateRange,
  formatDisplayDate,
  formatIsoTimeLabel,
  leaveTypeLabel,
  pluralizeDays,
  statusBadgeVariant,
  statusLabel
} from "@/lib/hours-format";
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
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertReason, setConvertReason] = useState("");

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

  const breakdownRows = useMemo(() => (report ? buildBreakdownRows(report) : []), [report]);

  const downloadAllMutation = useMutation({
    mutationFn: () => api.getAllEmployeesHoursReport(selectedPeriodId || undefined),
    onSuccess: (allReport) => {
      exportAllEmployeesHoursReportPdf(allReport);
      toast.success("Report downloaded");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to generate report")
  });

  const convertMutation = useMutation({
    mutationFn: () => api.convertEmployeeLeave(selectedEmployeeId, report!.period.id, convertReason.trim()),
    onSuccess: async () => {
      toast.success("Uncovered leave converted");
      setConvertDialogOpen(false);
      setConvertReason("");
      await queryClient.invalidateQueries({ queryKey: ["hours-employee-report"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to convert leave")
  });

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

      <div className="glass-panel p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
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
        <Button className="gap-1" disabled={downloadAllMutation.isPending} onClick={() => downloadAllMutation.mutate()}>
          <Download className="h-4 w-4" />
          {downloadAllMutation.isPending ? "Preparing..." : "Download All Employee Report"}
        </Button>
      </div>

      {loadingReport || fetchingReport ? (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading summary...
        </p>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Full Day Leave", value: String(report.leave.fullDay.count) },
              { label: "Half Day Leave", value: String(report.leave.halfDay.count) },
              { label: "Short Leave", value: String(report.leave.shortLeave.count) },
              { label: "Total Leave Hours", value: report.leave.totalLabel },
              { label: "Approved Overtime", value: report.approvedOvertimeLabel },
              { label: "Converted", value: report.convertedLabel },
              { label: "Remaining", value: report.remainingLabel },
              { label: "Pending Requests", value: String(report.pendingCount) }
            ].map((card) => (
              <div key={card.label} className="glass-panel p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          {report.canConvert ? (
            <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 border border-amber-500/30 bg-amber-500/5">
              <p className="text-sm">
                <span className="font-medium">{report.remainingLabel}</span> of {selectedEmployee?.name}'s leave is
                uncovered for this closed period.
              </p>
              <Button variant="outline" className="gap-1" onClick={() => setConvertDialogOpen(true)}>
                Convert to Leave
              </Button>
            </div>
          ) : null}

          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-lg font-semibold">
              {selectedEmployee?.name} — Leave Summary
            </h2>
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
                <th className="py-2 px-3 text-left font-medium">Details</th>
                <th className="py-2 px-3 text-right font-medium">Hours</th>
                <th className="py-2 px-3 text-left font-medium">Status</th>
                <th className="py-2 pl-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingRequests ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading requests...
                    </span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No requests match the filters.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={`${request.requestType}-${request.id}`} className="border-b border-border/20 align-top">
                    <td className="py-2 pr-3">{request.employee.name}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {request.requestType === "LEAVE"
                        ? formatDateRange(request.startDate, request.endDate)
                        : formatDisplayDate(request.date)}
                    </td>
                    <td className="py-2 px-3">
                      {request.requestType === "LEAVE" ? leaveTypeLabel(request.leaveType) : "Overtime"}
                    </td>
                    <td className="py-2 px-3 max-w-[240px]">
                      {request.requestType === "LEAVE" ? (
                        <div className="text-xs text-muted-foreground">
                          <p>{pluralizeDays(request.numberOfDays)}</p>
                          <p className="line-clamp-2">{request.reason}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          <p>
                            {request.project} · {formatIsoTimeLabel(request.startTime)}–{formatIsoTimeLabel(request.endTime)}
                          </p>
                          <p className="line-clamp-2">{request.reason}</p>
                        </div>
                      )}
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

      <Dialog open={convertDialogOpen} onOpenChange={(open) => !open && setConvertDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Leave</DialogTitle>
            <DialogDescription>
              This converts {selectedEmployee?.name}'s uncovered balance of{" "}
              <span className="font-semibold text-foreground">{report?.remainingLabel}</span> into a permanent
              recorded leave deduction. The original leave and overtime records are kept for audit.
            </DialogDescription>
          </DialogHeader>
          <Label>Reason</Label>
          <textarea
            value={convertReason}
            onChange={(e) => setConvertReason(e.target.value)}
            placeholder="Why is this balance being converted?"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!convertReason.trim() || convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? "Converting..." : "Confirm Conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
