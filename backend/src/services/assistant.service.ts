import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { projectService } from "./project.service.js";
import { taskService } from "./task.service.js";
import { userService } from "./user.service.js";
import { userRepository } from "../repositories/user.repository.js";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type AssistantAction =
  | "CREATE_PROJECT"
  | "CREATE_TASK"
  | "CREATE_EMPLOYEE"
  | "LIST_PROJECTS"
  | "LIST_TASKS"
  | "HELP"
  | "UNKNOWN";

type PlannerResult = {
  action: AssistantAction;
  arguments?: Record<string, unknown>;
  summary?: string;
};

type AssistantResult = {
  status: "completed" | "needs_input" | "failed";
  action: AssistantAction;
  reply: string;
  missingFields?: string[];
  result?: unknown;
  generatedCredentials?: { email: string; password: string };
};

const ACTION_HELP_TEXT =
  "I can help with: create project, create task, add team member, list projects, and list tasks. Example: 'Create task Soil testing for project NH848, assign to user@x.com, start today, 3 days'.";

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

function fallbackPlanner(message: string): PlannerResult {
  const lower = message.toLowerCase();
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] ?? "";

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
    const projectMatch = message.match(/for\s+project\s+(.+?)(?:\s+assign\s+to|\s+start|\s+for\s+\d+\s+days|$)/i);
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
    "Actions: CREATE_PROJECT, CREATE_TASK, CREATE_EMPLOYEE, LIST_PROJECTS, LIST_TASKS, HELP, UNKNOWN.",
    "For CREATE_PROJECT arguments: name, description.",
    "For CREATE_TASK arguments: title, description, project, assignedToEmail, assignedToName, allocatedAt, allottedDays.",
    "For CREATE_EMPLOYEE arguments: name, email, password, passwordMode (AUTO|MANUAL).",
    "For LIST_PROJECTS arguments: limit.",
    "For LIST_TASKS arguments: status, assignedToEmail, limit.",
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

export const assistantService = {
  async chat(input: {
    user: { id: string; role: string };
    message: string;
    conversation: ChatMessage[];
  }): Promise<AssistantResult> {
    const planned = (await planWithGroq(input.message, input.conversation)) ?? fallbackPlanner(input.message);
    const args = planned.arguments ?? {};

    switch (planned.action) {
      case "CREATE_PROJECT": {
        const roleError = requireAdmin(input.user.role);
        if (roleError) {
          return { status: "failed", action: planned.action, reply: roleError };
        }

        const name = normalizeText(args.name);
        if (!name) {
          return {
            status: "needs_input",
            action: planned.action,
            missingFields: ["project name"],
            reply: "Please provide the project name to create the project."
          };
        }

        const description = normalizeText(args.description) || undefined;
        const result = await projectService.create({ name, description });
        return {
          status: "completed",
          action: planned.action,
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
            action: planned.action,
            missingFields,
            reply: `Please provide: ${missingFields.join(", ")}.`
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
          action: planned.action,
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
            action: planned.action,
            missingFields,
            reply: `Please provide: ${missingFields.join(", ")}.`
          };
        }

        const password = shouldAutoGenerate ? generatePassword() : inputPassword;
        const result = await userService.createEmployee({ name, email, password });

        return {
          status: "completed",
          action: planned.action,
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
          return { status: "completed", action: planned.action, result: [], reply: "No projects found." };
        }
        const lines = sliced.map((project, index) => `${index + 1}. ${project.name}${project.projectNumber ? ` (${project.projectNumber})` : ""}`);
        return {
          status: "completed",
          action: planned.action,
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
          return { status: "completed", action: planned.action, result: list.items, reply: "No tasks found for this filter." };
        }

        const lines = list.items.map((task, index) => `${index + 1}. ${task.title} | ${task.project} | ${task.status}`);
        return {
          status: "completed",
          action: planned.action,
          result: list.items,
          reply: `Here are ${list.items.length} tasks:\n${lines.join("\n")}`
        };
      }

      case "HELP":
      case "UNKNOWN":
      default:
        return {
          status: "completed",
          action: planned.action,
          reply: ACTION_HELP_TEXT
        };
    }
  }
};
