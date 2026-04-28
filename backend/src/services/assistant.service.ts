import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { projectService } from "./project.service.js";
import { reportRepository } from "../repositories/report.repository.js";
import { commentService } from "./comment.service.js";
import { taskService } from "./task.service.js";
import { taskRepository } from "../repositories/task.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { userService } from "./user.service.js";
import { templateService } from "./template.service.js";
import { notificationService } from "./notification.service.js";

type PlannerResult = {
  action: AssistantAction;
  arguments?: Record<string, unknown>;
  summary?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantDraft = { action: AssistantAction; arguments?: Record<string, unknown>; missingFields?: string[] };

export type AssistantResult =
  | { status: "completed"; action: AssistantAction; reply: string; result?: unknown; generatedCredentials?: { email: string; password: string }; draft?: AssistantDraft }
  | { status: "needs_input"; action: AssistantAction; reply: string; missingFields: string[]; draft?: AssistantDraft }
  | { status: "failed"; action: AssistantAction; reply: string };

type AssistantAction =
  | "CREATE_PROJECT"
  | "CREATE_TASK"
  | "CREATE_EMPLOYEE"
  | "ADD_COMMENT"
  | "LIST_PROJECTS"
  | "LIST_TASKS"
  | "EMPLOYEE_PERFORMANCE"
  | "PENDING_TASKS_MONTH"
  | "SHOW_PENDING_TASK_DETAILS"
  | "DOWNLOAD_EMPLOYEE_REPORT"
  | "HELP"
  | "UNKNOWN";

const ACTION_HELP_TEXT =
  "I can help with: create project, create task, add team member, list projects, list tasks, show employee performance, show pending tasks this month, and download an employee report.";

function normalizeText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function toNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function extractJson(text: string): PlannerResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const raw = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(raw) as PlannerResult;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseDateInput(input: unknown): Date | null {
  const text = normalizeText(input).toLowerCase();
  if (!text) return null;
  if (text === "today") return new Date();
  if (text === "tomorrow") {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isCommandLike(message: string): boolean {
  return /\b(create|add|list|show|download|export|employee|project|task|report|member|name|email|password|details|status|assign|review)\b/i.test(message);
}

function extractEmail(message: string): string {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0]?.toLowerCase() ?? "";
}

function extractFollowUpArguments(
  action: AssistantAction,
  message: string,
  missingFields: string[] = []
): Record<string, unknown> {
  const lower = message.toLowerCase();
  const simpleValue = normalizeText(message);
  const email = extractEmail(message);
  const textFields = missingFields.map((field) => field.toLowerCase());

  const prefersField = (...needles: string[]) => textFields.some((field) => needles.some((needle) => field.includes(needle)));

  switch (action) {
    case "ADD_COMMENT": {
      const taskIdMatch = message.match(/task\s+#?([A-Za-z0-9-]+)/i);
      const commentMatch = message.match(/comment\s*[:=-]?\s*(.+)$/i);
      const args: Record<string, unknown> = {};

      if (taskIdMatch && normalizeText(taskIdMatch[1])) {
        args.taskId = normalizeText(taskIdMatch[1]);
      } else if (!isCommandLike(simpleValue) && simpleValue && simpleValue.length < 60 && !commentMatch) {
        // short free-text could be a task id or title
        args.taskId = simpleValue;
      }

      if (commentMatch && normalizeText(commentMatch[1])) {
        args.comment = normalizeText(commentMatch[1]);
      } else if (!isCommandLike(simpleValue) && simpleValue && simpleValue.length > 1) {
        // assume longer free-text is the comment body
        if (simpleValue.length > 40 || /\s/.test(simpleValue)) {
          args.comment = simpleValue;
        }
      }

      return args;
    }
    case "CREATE_PROJECT": {
      const nameMatch = message.match(/(?:project\s+name\s*[:=-]?\s*|name\s*[:=-]?\s*|project\s+)(.+)$/i);
      const descriptionMatch = message.match(/description\s*[:=-]?\s*(.+)$/i);
      const args: Record<string, unknown> = {};

      if (prefersField("name") && normalizeText(nameMatch?.[1])) {
        args.name = normalizeText(nameMatch?.[1]);
      } else if (prefersField("name") && simpleValue && !isCommandLike(simpleValue)) {
        args.name = simpleValue;
      }

      if (prefersField("description") && normalizeText(descriptionMatch?.[1])) {
        args.description = normalizeText(descriptionMatch?.[1]);
      }

      return args;
    }

    case "CREATE_EMPLOYEE": {
      const nameMatch = message.match(/(?:employee\s+name\s*[:=-]?\s*|name\s*[:=-]?\s*|member\s+)([a-z][a-z .'-]{1,80})/i);
      const wantsAuto = /auto|generate|random|temporary|temp/i.test(lower);
      const args: Record<string, unknown> = {};

      if (prefersField("name") && normalizeText(nameMatch?.[1])) {
        args.name = normalizeText(nameMatch?.[1]);
      } else if (prefersField("name") && simpleValue && !isCommandLike(simpleValue) && !email) {
        args.name = simpleValue;
      }

      if (prefersField("email") && email) {
        args.email = email;
      }

      if (wantsAuto) {
        args.passwordMode = "AUTO";
      }

      return args;
    }

    case "CREATE_TASK": {
      const titleMatch = message.match(/(?:task\s+name\s*[:=-]?\s*|title\s*[:=-]?\s*|task\s+)(.+?)(?:\s+for\s+project|\s+assign\s+to|\s+allotted|\s+start|\s+for\s+\d+\s+days|$)/i);
      const projectMatch = message.match(/for\s+project\s+(.+?)(?:\s+assign\s+to|\s+start|\s+for\s+\d+\s+days|$)/i);
      const assignedNameMatch = message.match(/(?:assign\s+to\s+name\s*[:=-]?\s*|assign\s+to\s+)([a-z][a-z .'-]{1,80})/i);
      const daysMatch = message.match(/(\d+)\s+days?/i);
      const dateMatch = message.match(/(?:start\s+date\s*[:=-]?\s*|on\s+)(.+)$/i);
      const args: Record<string, unknown> = {};

      if (prefersField("title", "task") && normalizeText(titleMatch?.[1])) {
        args.title = normalizeText(titleMatch?.[1]);
      } else if (prefersField("title", "task") && simpleValue && !isCommandLike(simpleValue)) {
        args.title = simpleValue;
      }

      if (prefersField("project") && normalizeText(projectMatch?.[1])) {
        args.project = normalizeText(projectMatch?.[1]);
      } else if (prefersField("project") && simpleValue && !isCommandLike(simpleValue) && !args.title) {
        args.project = simpleValue;
      }

      if (prefersField("assigned", "employee", "assignee") && email) {
        args.assignedToEmail = email;
      }

      if (prefersField("assigned", "employee", "assignee") && normalizeText(assignedNameMatch?.[1])) {
        args.assignedToName = normalizeText(assignedNameMatch?.[1]);
      } else if (prefersField("assigned", "employee", "assignee") && simpleValue && !isCommandLike(simpleValue) && !email) {
        args.assignedToName = simpleValue;
      }

      if (prefersField("day", "days", "duration") && daysMatch?.[1]) {
        args.allottedDays = Number(daysMatch[1]);
      } else if (prefersField("day", "days", "duration") && /^[0-9]+$/.test(simpleValue)) {
        args.allottedDays = Number(simpleValue);
      }

      if (prefersField("start", "date", "allocated") && normalizeText(dateMatch?.[1])) {
        args.allocatedAt = normalizeText(dateMatch?.[1]);
      } else {
        const parsedDate = parseDateInput(simpleValue);
        if (prefersField("start", "date", "allocated") && parsedDate) {
          args.allocatedAt = simpleValue;
        }
      }

      return args;
    }

    case "EMPLOYEE_PERFORMANCE":
    case "DOWNLOAD_EMPLOYEE_REPORT": {
      const nameMatch = message.match(/(?:employee|member)\s+([a-z][a-z .'-]{1,80})/i);
      const args: Record<string, unknown> = {};

      if (prefersField("name") && normalizeText(nameMatch?.[1])) {
        args.employeeName = normalizeText(nameMatch?.[1]);
      } else if (prefersField("name") && simpleValue && !isCommandLike(simpleValue) && !email) {
        args.employeeName = simpleValue;
      }

      if (prefersField("email") && email) {
        args.employeeEmail = email;
      }

      if (action === "DOWNLOAD_EMPLOYEE_REPORT") {
        if (/excel|xlsx/.test(lower)) {
          args.format = "excel";
        } else if (/csv/.test(lower)) {
          args.format = "csv";
        } else if (/pdf/.test(lower)) {
          args.format = "pdf";
        }
      }

      return args;
    }

    default:
      return {};
  }
}

function mergeDraftArguments(
  action: AssistantAction,
  baseArguments: Record<string, unknown>,
  message: string,
  missingFields: string[] = []
) {
  return {
    ...baseArguments,
    ...extractFollowUpArguments(action, message, missingFields)
  };
}

function fallbackPlanner(message: string, conversation: ChatMessage[]): PlannerResult {
  const lower = message.toLowerCase();
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] ?? "";
  const yesLike = /^(yes|haan|ha|show|show me|more|details|yes show)$/i.test(message.trim());
  const lastAssistantMessage = [...conversation].reverse().find((item) => item.role === "assistant")?.content.toLowerCase() ?? "";

  if (yesLike && lastAssistantMessage.includes("do you want to see more details")) {
    return { action: "SHOW_PENDING_TASK_DETAILS" };
  }

  if (/download.+report|export.+report/.test(lower) && /employee|member/.test(lower)) {
    const format = /excel|xlsx/.test(lower) ? "excel" : /csv/.test(lower) ? "csv" : "pdf";
    const nameMatch = message.match(/(?:employee|member)\s+([a-z][a-z .'-]{1,60})/i);
    return {
      action: "DOWNLOAD_EMPLOYEE_REPORT",
      arguments: {
        employeeName: normalizeText(nameMatch?.[1]),
        employeeEmail: emailMatch,
        format
      }
    };
  }

  if (/(comment|reply|add comment|post comment|leave comment)/.test(lower) && /task/.test(lower)) {
    const taskIdMatch = message.match(/task\s+#?([A-Za-z0-9-]+)/i);
    const commentMatch = message.match(/comment\s*[:=-]?\s*(.+)$/i);
    const titleMatch = message.match(/task\s+(?:"|')?([a-z0-9][a-z0-9 .'-]{1,120})/i);
    return {
      action: "ADD_COMMENT",
      arguments: {
        taskId: normalizeText(taskIdMatch?.[1] ?? titleMatch?.[1]),
        comment: normalizeText(commentMatch?.[1]) || undefined
      }
    };
  }

  if (/(performance|report card|summary)/.test(lower) && /employee|member/.test(lower)) {
    const nameMatch = message.match(/(?:employee|member)\s+([a-z][a-z .'-]{1,60})/i);
    return {
      action: "EMPLOYEE_PERFORMANCE",
      arguments: {
        employeeName: normalizeText(nameMatch?.[1]),
        employeeEmail: emailMatch
      }
    };
  }

  if (/pending\s+task/.test(lower) && /(this month|current month|this month\?)/.test(lower)) {
    return { action: "PENDING_TASKS_MONTH" };
  }

  if (/create\s+project|add\s+project/.test(lower)) {
    const nameMatch = message.match(/(?:project\s+name\s*[:=-]?|create\s+project\s+)(.+)$/i);
    return {
      action: "CREATE_PROJECT",
      arguments: {
        name: normalizeText(nameMatch?.[1])
      }
    };
  }

  if (/create\s+task|add\s+task/.test(lower)) {
    const titleMatch = message.match(/(?:task\s+name\s*[:=-]?|create\s+task\s+)(.+?)(?:\s+for\s+project|\s+assign\s+to|$)/i);
    const projectMatch = message.match(/for\s+project\s+(.+?)(?:\s+assign\s+to|\s+start|$)/i);
    const daysMatch = message.match(/(\d+)\s+days?/i);

    return {
      action: "CREATE_TASK",
      arguments: {
        title: normalizeText(titleMatch?.[1]),
        project: normalizeText(projectMatch?.[1]),
        assignedToEmail: emailMatch,
        allottedDays: daysMatch?.[1] ? Number(daysMatch[1]) : undefined,
        allocatedAt: /tomorrow/.test(lower) ? "tomorrow" : "today"
      }
    };
  }

  if (/add\s+(team\s+)?member|create\s+employee|add\s+employee|form\s+team/.test(lower)) {
    const nameMatch = message.match(/(?:name\s*[:=-]?|member\s+)([a-z][a-z .'-]{1,60})/i);
    const wantsAuto = /auto|generate|random|yourself/.test(lower);
    return {
      action: "CREATE_EMPLOYEE",
      arguments: {
        name: normalizeText(nameMatch?.[1]),
        email: emailMatch,
        passwordMode: wantsAuto ? "AUTO" : "MANUAL"
      }
    };
  }

  if (/list\s+projects|show\s+projects/.test(lower)) {
    return { action: "LIST_PROJECTS", arguments: { limit: 10 } };
  }

  if (/list\s+tasks|show\s+tasks/.test(lower)) {
    return { action: "LIST_TASKS", arguments: { limit: 10 } };
  }

  return { action: "HELP" };
}

async function planWithGroq(message: string, conversation: ChatMessage[]): Promise<PlannerResult | null> {
  if (!env.GROQ_API) {
    return null;
  }

  const systemPrompt = [
    "You are an assistant that converts chat into a strict JSON command.",
    "Return JSON only.",
    "Actions: CREATE_PROJECT, CREATE_TASK, CREATE_EMPLOYEE, ADD_COMMENT, LIST_PROJECTS, LIST_TASKS, EMPLOYEE_PERFORMANCE, PENDING_TASKS_MONTH, SHOW_PENDING_TASK_DETAILS, DOWNLOAD_EMPLOYEE_REPORT, HELP, UNKNOWN.",
    "For CREATE_PROJECT arguments: name, description.",
    "For CREATE_TASK arguments: title, description, project, assignedToEmail, assignedToName, allocatedAt, allottedDays.",
    "For CREATE_EMPLOYEE arguments: name, email, password, passwordMode (AUTO|MANUAL).",
    "For ADD_COMMENT arguments: taskId, comment",
    "For LIST_PROJECTS arguments: limit.",
    "For LIST_TASKS arguments: status, assignedToEmail, limit.",
    "For EMPLOYEE_PERFORMANCE arguments: employeeName, employeeEmail.",
    "For PENDING_TASKS_MONTH arguments: no fields needed.",
    "For SHOW_PENDING_TASK_DETAILS arguments: no fields needed.",
    "For DOWNLOAD_EMPLOYEE_REPORT arguments: employeeName, employeeEmail, format (pdf|excel|csv).",
    "If user omitted details, keep fields empty or null; do not invent emails.",
    "JSON shape: {\"action\":\"...\",\"arguments\":{},\"summary\":\"...\"}"
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversation.slice(-10).map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: message }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API}`
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.1,
        messages
      })
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "Groq planner request failed");
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    return extractJson(content);
  } catch (error) {
    logger.warn({ err: error }, "Groq planner unavailable");
    return null;
  }
}

async function resolveEmployeeId(args: Record<string, unknown>) {
  const email = normalizeText(args.assignedToEmail ?? args.email).toLowerCase();
  if (email) {
    const byEmail = await userRepository.findByEmail(email);
    if (byEmail?.role === "EMPLOYEE") {
      return byEmail.id;
    }
  }

  const name = normalizeText(args.assignedToName);
  if (!name) {
    return null;
  }

  const employees = await userRepository.findEmployees();
  const lowered = name.toLowerCase();
  const matches = employees.filter((employee) => employee.name.toLowerCase().includes(lowered));
  if (matches.length === 1) {
    return matches[0].id;
  }

  return null;
}

function generatePassword(): string {
  const safe = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&*!";
  const bytes = randomBytes(12);
  let output = "";
  for (let index = 0; index < 12; index += 1) {
    output += safe[bytes[index] % safe.length];
  }
  return output;
}

function requireAdmin(userRole: string): string | null {
  return userRole === "ADMIN" ? null : "This action requires an admin account.";
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function resolveEmployee(args: Record<string, unknown>) {
  const email = normalizeText(args.employeeEmail ?? args.assignedToEmail ?? args.email).toLowerCase();
  if (email) {
    const byEmail = await userRepository.findByEmail(email);
    if (byEmail?.role === "EMPLOYEE") {
      return byEmail;
    }
  }

  const name = normalizeText(args.employeeName ?? args.assignedToName ?? args.name);
  if (!name) {
    return null;
  }

  const employees = await userRepository.findEmployees();
  const lowered = name.toLowerCase();
  const exact = employees.find((employee) => employee.name.toLowerCase() === lowered);
  if (exact) {
    return exact;
  }

  const matches = employees.filter((employee) => employee.name.toLowerCase().includes(lowered));
  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

async function getEmployeePerformanceReply(args: Record<string, unknown>) {
  const employee = await resolveEmployee(args);
  if (!employee) {
    return {
      status: "needs_input" as const,
      action: "EMPLOYEE_PERFORMANCE" as const,
      missingFields: ["employee name or employee email"],
      reply: "Please provide the employee name or email so I can analyze performance."
    };
  }

  const [tasks, reports] = await Promise.all([
    taskRepository.findMany({ assignedToId: employee.id }, 0, 500),
    reportRepository.findMany({ submittedById: employee.id }, 0, 500)
  ]);

  const completed = tasks.filter((task) => task.status === "DONE").length;
  const pending = tasks.filter((task) => task.status === "TODO").length;
  const underReview = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const blocked = tasks.filter((task) => task.status === "BLOCKED").length;
  const adminComments = reports.filter((report) => Boolean(report.adminFeedback?.trim())).length;
  const ratedTasks = tasks.filter((task) => typeof task.rating === "number");
  const averageRating = ratedTasks.length
    ? (ratedTasks.reduce((sum, task) => sum + Number(task.rating ?? 0), 0) / ratedTasks.length).toFixed(2)
    : "-";
  const latestReport = reports[0];

  return {
    status: "completed" as const,
    action: "EMPLOYEE_PERFORMANCE" as const,
    result: {
      employeeId: employee.id,
      employeeName: employee.name,
      totalTasks: tasks.length,
      completed,
      pending,
      underReview,
      blocked,
      submittedReports: reports.length,
      adminComments,
      averageRating
    },
    reply: [
      `Employee Performance: ${employee.name}`,
      `Email: ${employee.email}`,
      `Total tasks assigned: ${tasks.length}`,
      `Completed tasks: ${completed}`,
      `Pending tasks: ${pending}`,
      `Under review: ${underReview}`,
      `Blocked tasks: ${blocked}`,
      `Reports submitted: ${reports.length}`,
      `Admin comments on reports: ${adminComments}`,
      `Average rating: ${averageRating}`,
      `Latest report submitted: ${latestReport ? formatDate(new Date(latestReport.createdAt)) : "No reports submitted yet"}`
    ].join("\n")
  };
}

async function getPendingTasksThisMonthReply(includeDetails: boolean) {
  const { start, end } = getCurrentMonthRange();
  const tasks = await taskRepository.findMany(
    {
      status: { in: ["TODO", "BLOCKED"] },
      allocatedAt: {
        gte: start,
        lte: end
      }
    },
    0,
    500
  );

  const monthLabel = start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const grouped = new Map<string, { employeeName: string; count: number; tasks: string[] }>();

  for (const task of tasks) {
    const key = task.assignedToId;
    const current = grouped.get(key) ?? {
      employeeName: task.assignedTo?.name ?? "Unknown Employee",
      count: 0,
      tasks: []
    };
    current.count += 1;
    if (current.tasks.length < 5) {
      current.tasks.push(task.title);
    }
    grouped.set(key, current);
  }

  if (!includeDetails) {
    return {
      status: "completed" as const,
      action: "PENDING_TASKS_MONTH" as const,
      result: { totalPendingTasks: tasks.length, month: monthLabel },
      reply: `There are ${tasks.length} pending tasks in ${monthLabel}. Do you want to see more details?`
    };
  }

  if (!tasks.length) {
    return {
      status: "completed" as const,
      action: "SHOW_PENDING_TASK_DETAILS" as const,
      result: { totalPendingTasks: 0, month: monthLabel },
      reply: `There are no pending tasks in ${monthLabel}.`
    };
  }

  const lines = Array.from(grouped.values())
    .sort((left, right) => right.count - left.count || left.employeeName.localeCompare(right.employeeName))
    .map((entry, index) => `${index + 1}. ${entry.employeeName}: ${entry.count} pending task(s) | ${entry.tasks.join(", ")}`);

  return {
    status: "completed" as const,
    action: "SHOW_PENDING_TASK_DETAILS" as const,
    result: { totalPendingTasks: tasks.length, month: monthLabel, grouped: lines },
    reply: `Pending task details for ${monthLabel}:\n${lines.join("\n")}`
  };
}

export const assistantService = {
  async chat(input: {
    user: { id: string; role: string };
    message: string;
    conversation: ChatMessage[];
    draft?: AssistantDraft;
  }): Promise<AssistantResult> {
    const planned = (await planWithGroq(input.message, input.conversation)) ?? fallbackPlanner(input.message, input.conversation);
    const useDraft = Boolean(input.draft && (planned.action === "HELP" || planned.action === "UNKNOWN" || planned.action === input.draft.action));
    const args = useDraft
      ? mergeDraftArguments(
          input.draft!.action,
          input.draft?.arguments ?? {},
          input.message,
          input.draft?.missingFields ?? []
        )
      : planned.arguments ?? {};
    const action = useDraft ? input.draft!.action : planned.action;

    switch (action) {
      case "ADD_COMMENT": {
        const taskRef = normalizeText((args as any).taskId ?? (args as any).task ?? (args as any).taskTitle ?? (args as any).taskSearch);
        const commentBody = normalizeText((args as any).comment ?? (args as any).body ?? "");

        const missingFields: string[] = [];
        if (!taskRef) missingFields.push("task id or exact task title");
        if (!commentBody) missingFields.push("comment text");

        if (missingFields.length) {
          return {
            status: "needs_input",
            action,
            missingFields,
            reply: `Please provide: ${missingFields.join(", ")}.`,
            draft: { action, arguments: args, missingFields }
          };
        }

        try {
          // try resolve as id first
          let resolvedTaskId: string | null = null;
          try {
            const t = await taskService.getById(taskRef);
            resolvedTaskId = t.id;
          } catch {
            // not an id or not found, try search by title
          }

          if (!resolvedTaskId) {
            const list = await taskService.list({ id: input.user.id, role: input.user.role as any }, { search: taskRef, limit: 10 });
            if (list.items.length === 1) {
              resolvedTaskId = list.items[0].id;
            } else if (!list.items.length) {
              return {
                status: "needs_input",
                action,
                missingFields: ["task id or exact task title"],
                reply: "I couldn't find a matching task. Please provide the exact task id or full task title.",
                draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
              };
            } else {
              const lines = list.items.map((t, i) => `${i + 1}. ${t.title} (${t.id})`).slice(0, 5);
              return {
                status: "needs_input",
                action,
                missingFields: ["task id or exact task title"],
                reply: `I found multiple tasks matching "${taskRef}". Please provide the task id exactly from the list:\n${lines.join("\n")}`,
                draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
              };
            }
          }

          const created = await commentService.create(resolvedTaskId, commentBody, { id: input.user.id, role: input.user.role as any });
          return {
            status: "completed",
            action,
            result: created,
            reply: `Comment added to task: ${created.taskId}`
          };
        } catch (err: any) {
          logger.warn({ err }, "Failed to add comment via assistant");
          return { status: "failed", action, reply: err?.message ?? "Failed to add comment" };
        }
      }
      case "CREATE_PROJECT": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        const name = normalizeText(args.name);
        if (!name) {
          return {
            status: "needs_input",
            action,
            missingFields: ["project name"],
            reply: "Please provide the project name to create the project.",
            draft: { action, arguments: args, missingFields: ["project name"] }
          };
        }

        const description = normalizeText(args.description) || undefined;
        const result = await projectService.create({ name, description });
        return {
          status: "completed",
          action,
          result,
          reply: `Project created successfully: ${result.name}.`
        };
      }

      case "CREATE_TASK": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        const title = normalizeText(args.title);
        const project = normalizeText(args.project);
        const allottedDays = toNumber(args.allottedDays);
        const allocatedAt = parseDateInput(args.allocatedAt);

        const missingFields: string[] = [];
        if (!title) missingFields.push("task title");
        if (!project) missingFields.push("project name");
        if (!allottedDays || allottedDays <= 0) missingFields.push("allotted days");
        if (!allocatedAt) missingFields.push("start date");

        const assignedToId = await resolveEmployeeId(args);
        if (!assignedToId) {
          missingFields.push("assigned employee email or exact name");
        }

        if (missingFields.length) {
          return {
            status: "needs_input",
            action,
            missingFields,
            reply: `Please provide: ${missingFields.join(", ")}.`,
            draft: { action, arguments: args, missingFields }
          };
        }

        const dueDate = new Date(allocatedAt!);
        dueDate.setDate(dueDate.getDate() + Number(allottedDays));

        const result = await taskService.create(
          {
            title,
            description: normalizeText(args.description) || "-",
            project,
            reportTemplateId: "",
            allocatedAt: allocatedAt!,
            dueDate,
            allottedDays: Number(allottedDays),
            assignedToId: assignedToId!,
            createdById: input.user.id,
            priority: "MEDIUM",
            status: "TODO"
          },
          input.user.id
        );

        return {
          status: "completed",
          action,
          result,
          reply: `Task created: ${result.title}, due on ${formatDate(dueDate)}.`
        };
      }

      case "CREATE_EMPLOYEE": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        const name = normalizeText(args.name);
        const email = normalizeText(args.email).toLowerCase();
        const passwordMode = normalizeText(args.passwordMode).toUpperCase();
        const inputPassword = normalizeText(args.password);

        const missingFields: string[] = [];
        if (!name) missingFields.push("employee name");
        if (!email) missingFields.push("employee email");

        const shouldAutoGenerate = passwordMode === "AUTO" || !inputPassword;
        if (!shouldAutoGenerate && inputPassword.length < 8) {
          missingFields.push("password (minimum 8 characters)");
        }

        if (missingFields.length) {
          return {
            status: "needs_input",
            action,
            missingFields,
            reply: `Please provide: ${missingFields.join(", ")}.`,
            draft: { action, arguments: args, missingFields }
          };
        }

        const password = shouldAutoGenerate ? generatePassword() : inputPassword;
        const result = await userService.createEmployee({ name, email, password });

        return {
          status: "completed",
          action,
          result,
          generatedCredentials: { email, password },
          reply: `Team member created successfully. Email: ${email}. Password: ${password}`
        };
      }

      case "LIST_PROJECTS": {
        const limit = Math.min(20, Math.max(1, toNumber(args.limit) ?? 10));
        const projects = await projectService.list();
        const sliced = projects.slice(0, limit);
        if (!sliced.length) {
          return { status: "completed", action, result: [], reply: "No projects found." };
        }
        const lines = sliced.map((project, index) => `${index + 1}. ${project.name}${project.projectNumber ? ` (${project.projectNumber})` : ""}`);
        return {
          status: "completed",
          action,
          result: sliced,
          reply: `Here are the top ${sliced.length} projects:\n${lines.join("\n")}`
        };
      }

      case "LIST_TASKS": {
        const filters: {
          assignedToId?: string;
          status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
          page?: number;
          limit?: number;
        } = {
          page: 1,
          limit: Math.min(20, Math.max(1, toNumber(args.limit) ?? 10))
        };

        const status = normalizeText(args.status).toUpperCase();
        if (["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(status)) {
          filters.status = status as "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
        }

        const assignedToId = await resolveEmployeeId(args);
        if (assignedToId && input.user.role === "ADMIN") {
          filters.assignedToId = assignedToId;
        }

        const list = await taskService.list(
          { id: input.user.id, role: input.user.role as "ADMIN" | "EMPLOYEE" },
          filters
        );

        if (!list.items.length) {
          return { status: "completed", action, result: list.items, reply: "No tasks found for this filter." };
        }

        const lines = list.items.map((task, index) => `${index + 1}. ${task.title} | ${task.project} | ${task.status}`);
        return {
          status: "completed",
          action,
          result: list.items,
          reply: `Here are ${list.items.length} tasks:\n${lines.join("\n")}`
        };
      }

      case "EMPLOYEE_PERFORMANCE": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        return getEmployeePerformanceReply(args);
      }

      case "PENDING_TASKS_MONTH": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        return getPendingTasksThisMonthReply(false);
      }

      case "SHOW_PENDING_TASK_DETAILS": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        return getPendingTasksThisMonthReply(true);
      }

      case "DOWNLOAD_EMPLOYEE_REPORT": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        const employee = await resolveEmployee(args);
        if (!employee) {
          return {
            status: "needs_input",
            action,
            missingFields: ["employee name or employee email"],
            reply: "Please provide the employee name or email so I can prepare the report download.",
            draft: { action, arguments: args, missingFields: ["employee name or employee email"] }
          };
        }

        const { start, end } = getCurrentMonthRange();
        const format = normalizeText(args.format).toLowerCase();

        return {
          status: "completed",
          action,
          result: {
            employeeId: employee.id,
            employeeName: employee.name,
            fromDate: start.toISOString().slice(0, 10),
            toDate: end.toISOString().slice(0, 10),
            format: format === "excel" || format === "csv" ? format : "pdf"
          },
          reply: `Preparing ${employee.name}'s report download for ${start.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.`
        };
      }

      case "HELP":
      case "UNKNOWN":
      default:
        return { status: "completed", action, reply: ACTION_HELP_TEXT };
    }
  }
};
