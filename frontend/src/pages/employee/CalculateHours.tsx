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
  format24HourTime,
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
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  MailWarning,
  Pencil,
  X
} from "lucide-react";
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
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessFrom, setAccessFrom] = useState("");
  const [accessTo, setAccessTo] = useState("");
  const [accessReason, setAccessReason] = useState("");
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [editingOvertimeId, setEditingOvertimeId] = useState<string | null>(null);
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);

  const { data: pastAccessRequests = [] } = useQuery({
    queryKey: ["hours-my-past-access"],
    queryFn: () => api.getMyPastOvertimeAccess()
  });

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

  // Past days the admin has approved for overtime entry (dates of an already-closed cycle).
  const approvedPastKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of pastAccessRequests) {
      if (item.status !== "APPROVED") continue;
      for (const key of daysInRange(item.startDate, item.endDate)) keys.add(key);
    }
    return keys;
  }, [pastAccessRequests]);
  const firstApprovedPastDate = useMemo(() => {
    const first = Array.from(approvedPastKeys).sort()[0];
    return first ? localDateFromInput(first) : undefined;
  }, [approvedPastKeys]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hours-my-past-access"] }),
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

  const updateLeaveMutation = useMutation({
    mutationFn: () =>
      api.updateLeaveRequest(editingLeaveId!, {
        startDate: leaveFrom,
        endDate: leaveTo,
        leaveType: leaveType as LeaveType,
        reason: leaveReason.trim()
      }),
    onSuccess: async () => {
      toast.success("Leave request updated");
      resetLeaveForm();
      setEditingLeaveId(null);
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update leave request")
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: (id: string) => api.deleteLeaveRequest(id),
    onSuccess: async () => {
      toast.success("Leave request withdrawn");
      setEditingLeaveId(null);
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to withdraw leave request")
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

  const updateOvertimeMutation = useMutation({
    mutationFn: () =>
      api.updateOvertimeRequest(editingOvertimeId!, {
        date: toRequestDateInput(selectedDate!),
        project: otProject,
        startTime: otFrom,
        endTime: otTo,
        reason: otReason.trim()
      }),
    onSuccess: async () => {
      toast.success("Overtime request updated");
      resetOvertimeForm();
      setEditingOvertimeId(null);
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update overtime request")
  });

  const deleteOvertimeMutation = useMutation({
    mutationFn: (id: string) => api.deleteOvertimeRequest(id),
    onSuccess: async () => {
      toast.success("Overtime request withdrawn");
      setEditingOvertimeId(null);
      setSelectedDate(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to withdraw overtime request")
  });

  const createAccessMutation = useMutation({
    mutationFn: () =>
      api.createPastOvertimeAccess({ startDate: accessFrom, endDate: accessTo, reason: accessReason.trim() }),
    onSuccess: async () => {
      toast.success("Request sent to admin");
      setAccessOpen(false);
      setAccessFrom("");
      setAccessTo("");
      setAccessReason("");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to send request")
  });

  const updateAccessMutation = useMutation({
    mutationFn: () =>
      api.updatePastOvertimeAccess(editingAccessId!, {
        startDate: accessFrom,
        endDate: accessTo,
        reason: accessReason.trim()
      }),
    onSuccess: async () => {
      toast.success("Request updated");
      setAccessOpen(false);
      setEditingAccessId(null);
      setAccessFrom("");
      setAccessTo("");
      setAccessReason("");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update request")
  });

  const deleteAccessMutation = useMutation({
    mutationFn: (id: string) => api.deletePastOvertimeAccess(id),
    onSuccess: async () => {
      toast.success("Request withdrawn");
      setEditingAccessId(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to withdraw request")
  });

  const withdrawRequest = (kind: "leave" | "overtime" | "access", id: string) => {
    if (!window.confirm("Withdraw this request?")) return;
    if (kind === "leave") deleteLeaveMutation.mutate(id);
    else if (kind === "overtime") deleteOvertimeMutation.mutate(id);
    else deleteAccessMutation.mutate(id);
  };

  const startEditLeave = (leave: (typeof leaveRequests)[number]) => {
    setEditingLeaveId(leave.id);
    setLeaveFrom(dateKey(leave.startDate));
    setLeaveTo(dateKey(leave.endDate));
    setLeaveType(leave.leaveType);
    setLeaveReason(leave.reason || "");
  };

  const startEditOvertime = (overtime: (typeof overtimeRequests)[number]) => {
    setEditingOvertimeId(overtime.id);
    setOtProject(overtime.project);
    setOtFrom(format24HourTime(overtime.startTime));
    setOtTo(format24HourTime(overtime.endTime));
    setOtReason(overtime.reason || "");
  };

  const startEditAccess = (item: (typeof pastAccessRequests)[number]) => {
    setEditingAccessId(item.id);
    setAccessFrom(dateKey(item.startDate));
    setAccessTo(dateKey(item.endDate));
    setAccessReason(item.reason || "");
    setAccessOpen(true);
  };

  const period = summary?.period;
  const periodStart = period ? new Date(period.startDate) : undefined;
  const periodEnd = period ? new Date(period.endDate) : undefined;
  const maxPastDateInput = (() => {
    if (!periodStart) return undefined;
    const day = new Date(periodStart);
    day.setDate(day.getDate() - 1);
    return toRequestDateInput(day);
  })();
  const accessRangeInvalid = Boolean(accessFrom && accessTo && accessTo < accessFrom);
  const accessDays =
    accessFrom && accessTo && !accessRangeInvalid
      ? daysBetweenInclusive(localDateFromInput(accessFrom), localDateFromInput(accessTo))
      : 0;

  const selectedKey = selectedDate ? dateKey(selectedDate) : null;
  const isPastDateSelected = Boolean(selectedKey && periodStart && selectedKey < dateKey(periodStart));
  const selectedLeave = selectedKey ? leaveByDate.get(selectedKey) : undefined;
  const selectedOvertime = selectedKey ? overtimeByDate.get(selectedKey) : undefined;
  const isEditingSelectedLeave = Boolean(selectedLeave && editingLeaveId === selectedLeave.id);
  const isEditingSelectedOvertime = Boolean(selectedOvertime && editingOvertimeId === selectedOvertime.id);
  const canRequestLeave = !selectedLeave || selectedLeave.status === "REJECTED" || isEditingSelectedLeave;
  const canRequestOvertime = !selectedOvertime || selectedOvertime.status === "REJECTED" || isEditingSelectedOvertime;

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
    const items: Array<{
      id: string;
      rawId: string;
      kind: "leave" | "overtime" | "access" | "converted";
      date: string;
      label: string;
      status: string;
      rejectionReason?: string | null;
    }> = [
      ...leaveRequests.map((item) => ({
        id: `leave-${item.id}`,
        rawId: item.id,
        kind: "leave" as const,
        date: item.startDate,
        label: `${leaveTypeLabel(item.leaveType)} Leave — ${formatDateRange(item.startDate, item.endDate)} (${pluralizeDays(item.numberOfDays)}) — ${item.durationLabel}`,
        status: item.status,
        rejectionReason: item.rejectionReason
      })),
      ...overtimeRequests.map((item) => ({
        id: `overtime-${item.id}`,
        rawId: item.id,
        kind: "overtime" as const,
        date: item.date,
        label: `Overtime — ${item.project} — ${formatIsoTimeLabel(item.startTime)} to ${formatIsoTimeLabel(item.endTime)} — ${item.durationLabel}`,
        status: item.status,
        rejectionReason: item.rejectionReason
      })),
      ...pastAccessRequests.map((item) => ({
        id: `access-${item.id}`,
        rawId: item.id,
        kind: "access" as const,
        date: item.createdAt,
        label: `Past-date overtime request — ${formatDateRange(item.startDate, item.endDate)} (${pluralizeDays(item.numberOfDays)})`,
        status: item.status,
        rejectionReason: item.status === "REJECTED" ? item.rejectionReason : item.reason
      })),
      ...convertedLeaves.map((item) => ({
        id: `converted-${item.id}`,
        rawId: item.id,
        kind: "converted" as const,
        date: item.calculationPeriod?.endDate ?? item.convertedAt,
        label: `Converted Leave — ${item.durationLabel}`,
        status: "APPROVED",
        rejectionReason: item.reason || null
      }))
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [leaveRequests, overtimeRequests, convertedLeaves, pastAccessRequests]);

  const isLoading = loadingSummary || loadingLeave || loadingOvertime;

  const openDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingLeaveId(null);
    setEditingOvertimeId(null);
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
        <Button
          variant="outline"
          className="gap-1.5 self-start"
          onClick={() => {
            setEditingAccessId(null);
            setAccessFrom("");
            setAccessTo("");
            setAccessReason("");
            setAccessOpen(true);
          }}
        >
          <CalendarPlus className="h-4 w-4" />
          Request Past Dates
        </Button>
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
          {approvedPastKeys.size > 0 ? (
            <div className="mt-4 border-t border-border/40 pt-3">
              <p className="px-2 text-sm font-medium">Approved past dates</p>
              <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                Admin approved these dates — click one to request overtime for it.
              </p>
              <Calendar
                key={firstApprovedPastDate?.toISOString()}
                defaultMonth={firstApprovedPastDate}
                disabled={(date) => !approvedPastKeys.has(dateKey(date))}
                modifiers={{ approvedPast: (date) => approvedPastKeys.has(dateKey(date)) }}
                modifiersClassNames={{ approvedPast: "ring-1 ring-primary/50 rounded-md font-semibold" }}
                onDayClick={(date, modifiers) => {
                  if (!modifiers.disabled) openDialog(date);
                }}
                components={{
                  DayContent: ({ date }) => {
                    const overtime = overtimeByDate.get(dateKey(date));
                    return (
                      <div className="relative flex h-9 w-9 items-center justify-center">
                        <span>{date.getDate()}</span>
                        {overtime ? (
                          <span
                            className={cn(
                              "absolute bottom-0.5 h-1.5 w-1.5 rounded-full",
                              dotClass(overtime.status, "overtime")
                            )}
                          />
                        ) : null}
                      </div>
                    );
                  }
                }}
              />
            </div>
          ) : null}
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={statusBadgeVariant(item.status as never)}>{statusLabel(item.status as never)}</Badge>
                    {item.status === "PENDING" && item.kind !== "converted" ? (
                      <>
                        {item.kind === "access" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Edit request"
                            onClick={() => {
                              const found = pastAccessRequests.find((entry) => entry.id === item.rawId);
                              if (found) startEditAccess(found);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Withdraw request"
                          onClick={() => withdrawRequest(item.kind as "leave" | "overtime" | "access", item.rawId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(selectedDate)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setEditingLeaveId(null);
            setEditingOvertimeId(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDate ? formatDateRange(selectedDate.toISOString(), selectedDate.toISOString()) : ""}</DialogTitle>
            <DialogDescription>
              {isPastDateSelected
                ? "Past date approved by admin — you can request overtime for it."
                : "Request leave or overtime for this date."}
            </DialogDescription>
          </DialogHeader>

          <Tabs key={selectedKey ?? "none"} defaultValue={isPastDateSelected ? "overtime" : "leave"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="leave" disabled={isPastDateSelected}>
                Leave
              </TabsTrigger>
              <TabsTrigger value="overtime">Overtime</TabsTrigger>
            </TabsList>

            <TabsContent value="leave" className="space-y-3 pt-3">
              {selectedLeave && !isEditingSelectedLeave ? (
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
                  {selectedLeave.status === "PENDING" ? (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => startEditLeave(selectedLeave)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive hover:text-destructive"
                        disabled={deleteLeaveMutation.isPending}
                        onClick={() => withdrawRequest("leave", selectedLeave.id)}
                      >
                        <X className="h-3.5 w-3.5" /> Withdraw
                      </Button>
                    </div>
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

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1"
                      disabled={
                        !leaveType ||
                        !leaveFrom ||
                        !leaveTo ||
                        leaveRangeInvalid ||
                        !leaveReason.trim() ||
                        createLeaveMutation.isPending ||
                        updateLeaveMutation.isPending
                      }
                      onClick={() => (isEditingSelectedLeave ? updateLeaveMutation.mutate() : createLeaveMutation.mutate())}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isEditingSelectedLeave
                        ? updateLeaveMutation.isPending
                          ? "Saving..."
                          : "Save Changes"
                        : createLeaveMutation.isPending
                          ? "Submitting..."
                          : "Request Leave"}
                    </Button>
                    {isEditingSelectedLeave ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingLeaveId(null);
                          resetLeaveForm();
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This date already has a {statusLabel(selectedLeave!.status).toLowerCase()} leave request.
                </p>
              )}
            </TabsContent>

            <TabsContent value="overtime" className="space-y-3 pt-3">
              {selectedOvertime && !isEditingSelectedOvertime ? (
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
                  {selectedOvertime.status === "PENDING" ? (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => startEditOvertime(selectedOvertime)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive hover:text-destructive"
                        disabled={deleteOvertimeMutation.isPending}
                        onClick={() => withdrawRequest("overtime", selectedOvertime.id)}
                      >
                        <X className="h-3.5 w-3.5" /> Withdraw
                      </Button>
                    </div>
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

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1"
                      disabled={
                        createOvertimeMutation.isPending ||
                        updateOvertimeMutation.isPending ||
                        !otProject.trim() ||
                        !otFrom ||
                        !otTo ||
                        otDurationMinutes <= 0 ||
                        !otReason.trim()
                      }
                      onClick={() =>
                        isEditingSelectedOvertime ? updateOvertimeMutation.mutate() : createOvertimeMutation.mutate()
                      }
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      {isEditingSelectedOvertime
                        ? updateOvertimeMutation.isPending
                          ? "Saving..."
                          : "Save Changes"
                        : createOvertimeMutation.isPending
                          ? "Submitting..."
                          : "Request Overtime"}
                    </Button>
                    {isEditingSelectedOvertime ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingOvertimeId(null);
                          resetOvertimeForm();
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
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

      <Dialog
        open={accessOpen}
        onOpenChange={(open) => {
          setAccessOpen(open);
          if (!open) setEditingAccessId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccessId ? "Edit Past-Date Request" : "Request Past Dates"}</DialogTitle>
            <DialogDescription>
              Missed logging overtime for days of an earlier cycle? Ask the admin to reopen those dates. Once
              approved they appear on your calendar so you can add overtime for them as usual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From Date</Label>
                <Input
                  type="date"
                  value={accessFrom}
                  max={maxPastDateInput}
                  onChange={(e) => setAccessFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To Date</Label>
                <Input
                  type="date"
                  value={accessTo}
                  min={accessFrom || undefined}
                  max={maxPastDateInput}
                  onChange={(e) => setAccessTo(e.target.value)}
                />
              </div>
            </div>
            {accessRangeInvalid ? (
              <p className="text-xs text-destructive">To Date cannot be before From Date.</p>
            ) : accessDays > 0 ? (
              <p className="text-xs text-muted-foreground">Days requested: {pluralizeDays(accessDays)}</p>
            ) : null}
            <Label>Reason</Label>
            <textarea
              value={accessReason}
              onChange={(e) => setAccessReason(e.target.value)}
              placeholder="Why do you need to add overtime for these past dates?"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              className="w-full gap-1"
              disabled={
                !accessFrom ||
                !accessTo ||
                accessRangeInvalid ||
                !accessReason.trim() ||
                createAccessMutation.isPending ||
                updateAccessMutation.isPending
              }
              onClick={() => (editingAccessId ? updateAccessMutation.mutate() : createAccessMutation.mutate())}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              {editingAccessId
                ? updateAccessMutation.isPending
                  ? "Saving..."
                  : "Save Changes"
                : createAccessMutation.isPending
                  ? "Sending..."
                  : "Send Request to Admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
