import type { TaskItem } from "./domain";
import { formatHodDate, getHodTaskActivityStatus, type HodTaskActivityStatus } from "./hod-dashboard";

export type HodActivityChartRow = {
  id: string;
  title: string;
  status: HodTaskActivityStatus;
  startDate: string;
  endDate: string;
  start: Date;
  end: Date;
  daysCount: number;
  leftPct: number;
  widthPct: number;
  isOngoing: boolean;
};

export type HodActivityChartData = {
  rows: HodActivityChartRow[];
  timelineStart: Date | null;
  timelineEnd: Date | null;
  totalDays: number;
  axisDates: string[];
};

function toDateOnly(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInclusive(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(Math.floor(diff / 86400000) + 1, 1);
}

function getTaskStart(task: TaskItem): Date | null {
  return toDateOnly(task.allocatedAt ?? task.createdAt);
}

function getTaskEnd(task: TaskItem, status: HodTaskActivityStatus): { end: Date; isOngoing: boolean } | null {
  const approved = task.reviewCompletedAt ? toDateOnly(task.reviewCompletedAt) : null;
  if (approved) {
    return { end: approved, isOngoing: false };
  }

  const submitted = task.submittedForReviewAt ?? task.actualCompletedAt;
  if (submitted) {
    const end = toDateOnly(submitted);
    if (end) {
      return { end, isOngoing: status === "TASK_PENDING" };
    }
  }

  const start = getTaskStart(task);
  if (!start) return null;

  if (status === "TASK_PENDING") {
    return { end: toDateOnly(new Date().toISOString())!, isOngoing: true };
  }

  return null;
}

export function buildHodActivityChartData(tasks: TaskItem[]): HodActivityChartData {
  const prepared = tasks
    .map((task) => {
      const status = getHodTaskActivityStatus(task);
      const start = getTaskStart(task);
      const endInfo = getTaskEnd(task, status);
      if (!start || !endInfo) return null;

      const end = endInfo.end.getTime() < start.getTime() ? start : endInfo.end;
      const daysCount = task.completionDays && task.completionDays > 0 ? task.completionDays : daysInclusive(start, end);

      return {
        id: task.id,
        title: task.title,
        status,
        startDate: toDateInputValue(start),
        endDate: toDateInputValue(end),
        start,
        end,
        daysCount,
        isOngoing: endInfo.isOngoing
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (!prepared.length) {
    return { rows: [], timelineStart: null, timelineEnd: null, totalDays: 0, axisDates: [] };
  }

  const minTime = Math.min(...prepared.map((row) => row.start.getTime()));
  const maxTime = Math.max(...prepared.map((row) => row.end.getTime()));
  const timelineStart = new Date(minTime);
  const timelineEnd = new Date(maxTime);
  const totalDays = Math.max(daysInclusive(timelineStart, timelineEnd), 1);

  const rows: HodActivityChartRow[] = prepared.map((row) => {
    const startOffset = Math.floor((row.start.getTime() - minTime) / 86400000);
    const spanDays = daysInclusive(row.start, row.end);
    return {
      ...row,
      leftPct: (startOffset / totalDays) * 100,
      widthPct: Math.max((spanDays / totalDays) * 100, 1.2)
    };
  });

  const axisDates = [0, 0.25, 0.5, 0.75, 1].map((point) => {
    const tickDate = new Date(minTime + point * (maxTime - minTime));
    return formatHodDate(tickDate.toISOString());
  });

  return { rows, timelineStart, timelineEnd, totalDays, axisDates };
}

export function getHodActivityChartBarClass(status: HodTaskActivityStatus, isOngoing: boolean): string {
  if (isOngoing) {
    return "fill-amber-500";
  }
  switch (status) {
    case "APPROVED":
      return "fill-emerald-500";
    case "TASK_COMPLETED":
      return "fill-sky-500";
    case "TASK_PENDING":
      return "fill-amber-500";
    default:
      return "fill-muted-foreground";
  }
}
