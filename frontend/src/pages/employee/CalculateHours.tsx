import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { LeaveType, TaskItem } from "@/lib/domain";
import {
  LEAVE_DURATION_MINUTES,
  LEAVE_TYPE_OPTIONS,
  dateKey,
  daysBetweenInclusive,
  formatDateRange,
  formatIsoTimeLabel,
  leaveTypeLabel,
  minutesToLabel,
  pluralizeDays,
  statusBadgeVariant,
  statusLabel,
  toRequestDateInput
} from "@/lib/hours-format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock3, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getProjectLabel(task: TaskItem): string {
  return task.projectNumber?.trim() || task.projectCode?.trim() || task.project?.trim() || "";
}

function localDateFromInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Days covered by a leave request, as local-calendar-day keys. */
function daysInRange(startDate: string, endDate: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(dateKey(startDate));
  const end = new Date(dateKey(endDate));
  while (cursor.getTime() <= end.getTime()) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function dotClass(status: string, kind: "leave" | "overtime") {
  if (status === "REJECTED") return "bg-red-400";
  if (status === "PENDING") return "bg-amber-500";
  return kind === "leave" ? "bg-emerald-500" : "bg-sky-500";
}

export default function CalculateHours() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType | "">("");
  const [leaveReason, setLeaveReason] = useState("");
  const [otProject, setOtProject] = useState("");
  const [otFrom, setOtFrom] = useState("");
  const [otTo, setOtTo] = useState("");
  const [otReason, setOtReason] = useState("");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["hours-my-summary"],
    queryFn: () => api.getMyHoursSummary()
  });

  const { data: leaveRequests = [], isLoading: loadingLeave } = useQuery({
    queryKey: ["hours-my-leave"],
    queryFn: () => api.getMyLeaveRequests()
  });

  const { data: overtimeRequests = [], isLoading: loadingOvertime } = useQuery({
    queryKey: ["hours-my-overtime"],
    queryFn: () => api.getMyOvertimeRequests()
  });

  const { data: convertedLeaves = [] } = useQuery({
    queryKey: ["hours-my-converted-leaves"],
    queryFn: () => api.getMyConvertedLeaves()
  });

  const { data: myTasksPage } = useQuery({
    queryKey: ["tasks", "hours-projects"],
    queryFn: () => api.getTasks({ limit: 200 })
  });

  const projectOptions = useMemo(() => {
    const labels = new Set<string>();
    (myTasksPage?.items ?? []).forEach((task: TaskItem) => {
      const label = getProjectLabel(task);
      if (label) labels.add(label);
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [myTasksPage]);

  // Per calendar day: the leave (if any day within an active range covers it) and overtime (if any) that day.
  const leaveByDate = useMemo(() => {
    const map = new Map<string, (typeof leaveRequests)[number]>();
    for (const item of leaveRequests) {
      if (item.status === "REJECTED") continue;
      for (const key of daysInRange(item.startDate, item.endDate)) {
        map.set(key, item);
      }
    }
    // Rejected requests fill in only where nothing active already covers that day.
    for (const item of leaveRequests) {
      if (item.status !== "REJECTED") continue;
      for (const key of daysInRange(item.startDate, item.endDate)) {
        if (!map.has(key)) map.set(key, item);
      }
    }
    return map;
  }, [leaveRequests]);

  const overtimeByDate = useMemo(() => {
    const map = new Map<string, (typeof overtimeRequests)[number]>();
    const sorted = [...overtimeRequests].sort((a, b) =>
      a.status === "REJECTED" ? 1 : b.status === "REJECTED" ? -1 : 0
    );
    for (const item of sorted) {
      const key = dateKey(item.date);
      if (!map.has(key) || item.status !== "REJECTED") map.set(key, item);
    }
    return map;
  }, [overtimeRequests]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hours-my-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["hours-my-leave"] }),
      queryClient.invalidateQueries({ queryKey: ["hours-my-overtime"] })
    ]);
  };

  const resetLeaveForm = () => {
    setLeaveFrom("");
    setLeaveTo("");
    setLeaveType("");
    setLeaveReason("");
  };
  const resetOvertimeForm = () => {
    setOtProject("");
    setOtFrom("");
    setOtTo("");
    setOtReason("");
  };

  const createLeaveMutation = useMutation({
    mutationFn: () =>
      api.createLeaveRequest({
        startDate: leaveFrom,
        endDate: leaveTo,
        leaveType: leaveType as LeaveType,
        reason: leaveReason.trim()
      }),
    onSuccess: async () => {
      toast.success("Leave request submitted");
      resetLeaveForm();
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to submit leave request")
  });

  const createOvertimeMutation = useMutation({
    mutationFn: () =>
      api.createOvertimeRequest({
        date: toRequestDateInput(selectedDate!),
        project: otProject,
        startTime: otFrom,
        endTime: otTo,
        reason: otReason.trim()
      }),
    onSuccess: async () => {
      toast.success("Overtime request submitted");
      resetOvertimeForm();
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to submit overtime request")
  });

  const period = summary?.period;
  const periodStart = period ? new Date(period.startDate) : undefined;
  const periodEnd = period ? new Date(period.endDate) : undefined;

  const selectedKey = selectedDate ? dateKey(selectedDate) : null;
  const selectedLeave = selectedKey ? leaveByDate.get(selectedKey) : undefined;
  const selectedOvertime = selectedKey ? overtimeByDate.get(selectedKey) : undefined;
  const canRequestLeave = !selectedLeave || selectedLeave.status === "REJECTED";
  const canRequestOvertime = !selectedOvertime || selectedOvertime.status === "REJECTED";

  const leaveNumberOfDays = leaveFrom && leaveTo ? daysBetweenInclusive(localDateFromInput(leaveFrom), localDateFromInput(leaveTo)) : 0;
  const leaveTotalMinutes = leaveType && leaveNumberOfDays > 0 ? leaveNumberOfDays * LEAVE_DURATION_MINUTES[leaveType] : 0;
  const leaveRangeInvalid = Boolean(leaveFrom && leaveTo && leaveTo < leaveFrom);

  const otDurationMinutes = useMemo(() => {
    if (!otFrom || !otTo) return 0;
    const [fh, fm] = otFrom.split(":").map(Number);
    const [th, tm] = otTo.split(":").map(Number);
    return th * 60 + tm - (fh * 60 + fm);
  }, [otFrom, otTo]);

  const timelineItems = useMemo(() => {
    const items: Array<{ id: string; date: string; label: string; status: string; rejectionReason?: string | null }> = [
      ...leaveRequests.map((item) => ({
        id: `leave-${item.id}`,
        date: item.startDate,
        label: `${leaveTypeLabel(item.leaveType)} Leave — ${formatDateRange(item.startDate, item.endDate)} (${pluralizeDays(item.numberOfDays)}) — ${item.durationLabel}`,
        status: item.status,
        rejectionReason: item.rejectionReason
      })),
      ...overtimeRequests.map((item) => ({
        id: `overtime-${item.id}`,
        date: item.date,
        label: `Overtime — ${item.project} — ${formatIsoTimeLabel(item.startTime)} to ${formatIsoTimeLabel(item.endTime)} — ${item.durationLabel}`,
        status: item.status,
        rejectionReason: item.rejectionReason
      })),
      ...convertedLeaves.map((item) => ({
        id: `converted-${item.id}`,
        date: item.calculationPeriod?.endDate ?? item.convertedAt,
        label: `Converted Leave — ${item.durationLabel}`,
        status: "APPROVED",
        rejectionReason: item.reason || null
      }))
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [leaveRequests, overtimeRequests, convertedLeaves]);

  const isLoading = loadingSummary || loadingLeave || loadingOvertime;

  const openDialog = (date: Date) => {
    setSelectedDate(date);
    const key = toRequestDateInput(date);
    setLeaveFrom(key);
    setLeaveTo(key);
    setLeaveReason("");
    setOtFrom("");
    setOtTo("");
    setOtProject("");
    setOtReason("");
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Calculate Hours</h1>
          <p className="page-subtitle">
            {period
              ? `Cycle: ${formatDateRange(period.startDate, period.endDate)}`
              : "Leave and overtime for the current calculation cycle."}
          </p>
        </div>
        {summary ? (
          <div className="flex flex-wrap gap-2 self-start">
            <Badge variant="secondary" className="rounded-full">
              Total Leave {summary.leave.totalLabel}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Approved OT {summary.approvedOvertimeLabel}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              Remaining {summary.remainingLabel}
            </Badge>
            {summary.pendingCount > 0 ? (
              <Badge variant="outline" className="rounded-full gap-1">
                <MailWarning className="h-3.5 w-3.5" />
                {summary.pendingCount} pending
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-4">
        <div className="glass-panel p-4 w-fit mx-auto xl:mx-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar...
            </p>
          ) : (
            <>
              <Calendar
                defaultMonth={periodStart}
                fromDate={periodStart}
                toDate={periodEnd}
                onDayClick={(date) => openDialog(date)}
                components={{
                  DayContent: ({ date }) => {
                    const key = dateKey(date);
                    const leave = leaveByDate.get(key);
                    const overtime = overtimeByDate.get(key);
                    return (
                      <div className="relative flex h-9 w-9 items-center justify-center">
                        <span>{date.getDate()}</span>
                        {leave || overtime ? (
                          <div className="absolute bottom-0.5 flex gap-0.5">
                            {leave ? (
                              <span className={cn("h-1.5 w-1.5 rounded-full", dotClass(leave.status, "leave"))} />
                            ) : null}
                            {overtime ? (
                              <span className={cn("h-1.5 w-1.5 rounded-full", dotClass(overtime.status, "overtime"))} />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                }}
              />
              <div className="flex flex-wrap gap-3 px-2 pb-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Leave approved
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Overtime approved
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pending
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Rejected
                </span>
              </div>
            </>
          )}
        </div>

        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Your Requests
          </h2>
          {timelineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No leave or overtime requests yet. Click a date on the calendar to add one.
            </p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {timelineItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/40 bg-card/60 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.rejectionReason ? (
                      <p className="text-xs text-muted-foreground mt-0.5">Reason: {item.rejectionReason}</p>
                    ) : null}
                  </div>
                  <Badge variant={statusBadgeVariant(item.status as never)} className="shrink-0">
                    {statusLabel(item.status as never)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDate ? formatDateRange(selectedDate.toISOString(), selectedDate.toISOString()) : ""}</DialogTitle>
            <DialogDescription>Request leave or overtime for this date.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="leave">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="leave">Leave</TabsTrigger>
              <TabsTrigger value="overtime">Overtime</TabsTrigger>
            </TabsList>

            <TabsContent value="leave" className="space-y-3 pt-3">
              {selectedLeave ? (
                <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-1">
                  <p className="text-sm font-medium">
                    {leaveTypeLabel(selectedLeave.leaveType)} — {formatDateRange(selectedLeave.startDate, selectedLeave.endDate)} (
                    {pluralizeDays(selectedLeave.numberOfDays)}) — {selectedLeave.durationLabel}
                  </p>
                  <Badge variant={statusBadgeVariant(selectedLeave.status)}>{statusLabel(selectedLeave.status)}</Badge>
                  {selectedLeave.reason ? (
                    <p className="text-xs text-muted-foreground">Reason: {selectedLeave.reason}</p>
                  ) : null}
                  {selectedLeave.status === "REJECTED" && selectedLeave.rejectionReason ? (
                    <p className="text-xs text-muted-foreground">Admin note: {selectedLeave.rejectionReason}</p>
                  ) : null}
                </div>
              ) : null}

              {canRequestLeave ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">From Date</Label>
                      <Input
                        type="date"
                        value={leaveFrom}
                        min={periodStart ? toRequestDateInput(periodStart) : undefined}
                        max={periodEnd ? toRequestDateInput(periodEnd) : undefined}
                        onChange={(e) => setLeaveFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">To Date</Label>
                      <Input
                        type="date"
                        value={leaveTo}
                        min={leaveFrom || (periodStart ? toRequestDateInput(periodStart) : undefined)}
                        max={periodEnd ? toRequestDateInput(periodEnd) : undefined}
                        onChange={(e) => setLeaveTo(e.target.value)}
                      />
                    </div>
                  </div>
                  {leaveRangeInvalid ? (
                    <p className="text-xs text-destructive">To Date cannot be before From Date.</p>
                  ) : leaveNumberOfDays > 0 ? (
                    <p className="text-xs text-muted-foreground">Number of Days: {pluralizeDays(leaveNumberOfDays)}</p>
                  ) : null}

                  <Label>Leave Type</Label>
                  <Select value={leaveType} onValueChange={(value) => setLeaveType(value as LeaveType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} — {option.minutes / 60}h / day
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {leaveTotalMinutes > 0 ? (
                    <p className="text-sm font-medium">Total Leave Hours: {minutesToLabel(leaveTotalMinutes)}</p>
                  ) : null}

                  <Label>Reason</Label>
                  <textarea
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Why do you need this leave?"
                    rows={2}
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />

                  <Button
                    className="w-full gap-1"
                    disabled={
                      !leaveType ||
                      !leaveFrom ||
                      !leaveTo ||
                      leaveRangeInvalid ||
                      !leaveReason.trim() ||
                      createLeaveMutation.isPending
                    }
                    onClick={() => createLeaveMutation.mutate()}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {createLeaveMutation.isPending ? "Submitting..." : "Request Leave"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This date already has a {statusLabel(selectedLeave!.status).toLowerCase()} leave request.
                </p>
              )}
            </TabsContent>

            <TabsContent value="overtime" className="space-y-3 pt-3">
              {selectedOvertime ? (
                <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-1">
                  <p className="text-sm font-medium">
                    Overtime — {selectedOvertime.project} — {formatIsoTimeLabel(selectedOvertime.startTime)} to{" "}
                    {formatIsoTimeLabel(selectedOvertime.endTime)} — {selectedOvertime.durationLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedOvertime.reason}</p>
                  <Badge variant={statusBadgeVariant(selectedOvertime.status)}>
                    {statusLabel(selectedOvertime.status)}
                  </Badge>
                  {selectedOvertime.status === "REJECTED" && selectedOvertime.rejectionReason ? (
                    <p className="text-xs text-muted-foreground">Reason: {selectedOvertime.rejectionReason}</p>
                  ) : null}
                </div>
              ) : null}

              {canRequestOvertime ? (
                <div className="space-y-2">
                  <Label>Project</Label>
                  {projectOptions.length > 0 ? (
                    <Select value={otProject} onValueChange={setOtProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectOptions.map((project) => (
                          <SelectItem key={project} value={project}>
                            {project}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter project name"
                      value={otProject}
                      onChange={(e) => setOtProject(e.target.value)}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                      <Input type="time" value={otFrom} onChange={(e) => setOtFrom(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                      <Input type="time" value={otTo} onChange={(e) => setOtTo(e.target.value)} />
                    </div>
                  </div>
                  {otFrom && otTo ? (
                    otDurationMinutes > 0 ? (
                      <p className="text-sm font-medium">Duration: {minutesToLabel(otDurationMinutes)}</p>
                    ) : (
                      <p className="text-xs text-destructive">To time must be after From time.</p>
                    )
                  ) : null}

                  <Label>Reason</Label>
                  <textarea
                    value={otReason}
                    onChange={(e) => setOtReason(e.target.value)}
                    placeholder="Why was this overtime needed?"
                    rows={2}
                    className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />

                  <Button
                    className="w-full gap-1"
                    disabled={
                      createOvertimeMutation.isPending ||
                      !otProject.trim() ||
                      !otFrom ||
                      !otTo ||
                      otDurationMinutes <= 0 ||
                      !otReason.trim()
                    }
                    onClick={() => createOvertimeMutation.mutate()}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    {createOvertimeMutation.isPending ? "Submitting..." : "Request Overtime"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This date already has a {statusLabel(selectedOvertime!.status).toLowerCase()} overtime request.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
