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

        const resolved = await resolveTaskByReference(taskRef, input.user);
        if (!resolved.task) {
          if (resolved.matches.length > 1) {
            const lines = resolved.matches.map((item, index) => `${index + 1}. ${item.title} (${item.id})`).slice(0, 5);
            return {
              status: "needs_input",
              action,
              missingFields: ["task id or exact task title"],
              reply: `I found multiple tasks matching "${taskRef}". Please provide the exact task id:\n${lines.join("\n")}`,
              draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
            };
          }

          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "I couldn't find a matching task. Please provide the exact task id or full task title.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const created = await commentService.create(resolved.task.id, commentBody, { id: input.user.id, role: input.user.role as any });
        return {
          status: "completed",
          action,
          result: created,
          reply: `Comment added to task: ${resolved.task.title}.`
        };
      }
      case "LIST_COMMENTS": {
        const taskRef = normalizeText((args as any).taskId ?? (args as any).task ?? (args as any).taskTitle ?? (args as any).taskSearch);

        if (!taskRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "Please provide the task id or exact task title so I can list its comments.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const resolved = await resolveTaskByReference(taskRef, input.user);
        if (!resolved.task) {
          if (resolved.matches.length > 1) {
            const lines = resolved.matches.map((item, index) => `${index + 1}. ${item.title} (${item.id})`).slice(0, 5);
            return {
              status: "needs_input",
              action,
              missingFields: ["task id or exact task title"],
              reply: `I found multiple tasks matching "${taskRef}". Please provide the exact task id:\n${lines.join("\n")}`,
              draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
            };
          }

          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "I couldn't find a matching task. Please provide the exact task id or full task title.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const comments = await commentService.list(resolved.task.id, { id: input.user.id, role: input.user.role as any });
        if (!comments.length) {
          return { status: "completed", action, result: [], reply: `No comments found for task ${resolved.task.title}.` };
        }

        const lines = comments.map((comment, index) => `${index + 1}. ${comment.body} (${formatDate(new Date(comment.createdAt))})`);
        return {
          status: "completed",
          action,
          result: comments,
          reply: `Comments for ${resolved.task.title}:\n${lines.join("\n")}`
        };
      }
      case "LIST_NOTIFICATIONS": {
        const limit = Math.min(20, Math.max(1, toNumber((args as any).limit) ?? 10));
        const notifications = await notificationService.listForUser(input.user.id, limit);
        if (!notifications.length) {
          return { status: "completed", action, result: [], reply: "You have no notifications." };
        }

        return {
          status: "completed",
          action,
          result: notifications,
          reply: [`Here are your latest ${notifications.length} notifications:`, ...notifications.map((notification, index) => `${index + 1}. ${formatNotificationLine(notification)}`)].join("\n")
        };
      }
      case "MARK_NOTIFICATION_READ": {
        const notificationId = normalizeText((args as any).notificationId ?? (args as any).id);
        if (!notificationId) {
          return {
            status: "needs_input",
            action,
            missingFields: ["notification id"],
            reply: "Please provide the notification id to mark it as read.",
            draft: { action, arguments: args, missingFields: ["notification id"] }
          };
        }

        const result = await notificationService.markRead(notificationId, input.user.id);
        return {
          status: "completed",
          action,
          result,
          reply: result.updated ? "Notification marked as read." : "No matching notification was found."
        };
      }
      case "MARK_ALL_NOTIFICATIONS_READ": {
        const result = await notificationService.markAllRead(input.user.id);
        return {
          status: "completed",
          action,
          result,
          reply: result.updated ? `Marked ${result.updated} notification(s) as read.` : "You had no unread notifications."
        };
      }
      case "LIST_TEMPLATES": {
        const templates = await templateService.list();
        if (!templates.length) {
          return { status: "completed", action, result: [], reply: "No templates found." };
        }

        const lines = templates.map((template, index) => `${index + 1}. ${template.name}${template.description ? ` - ${template.description}` : ""}`);
        return {
          status: "completed",
          action,
          result: templates,
          reply: `Here are the available templates:\n${lines.join("\n")}`
        };
      }
      case "CREATE_TEMPLATE": {
        const name = normalizeText((args as any).name);
        const description = normalizeText((args as any).description) || undefined;
        const fields = Array.isArray((args as any).fields) ? (args as any).fields : [];

        if (!name) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template name"],
            reply: "Please provide the template name to create it.",
            draft: { action, arguments: args, missingFields: ["template name"] }
          };
        }

        const existing = await templateService.list();
        const duplicate = existing.find((template) => template.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
          return { status: "failed", action, reply: `A template named "${name}" already exists.` };
        }

        const result = await templateService.create({ name, description, fields }, input.user.id);
        return { status: "completed", action, result, reply: `Template created: ${result.name}.` };
      }
      case "UPDATE_TEMPLATE": {
        const templateRef = normalizeText((args as any).templateRef ?? (args as any).id ?? (args as any).name);
        const name = normalizeText((args as any).name);
        const description = normalizeText((args as any).description) || undefined;
        const fields = Array.isArray((args as any).fields) ? (args as any).fields : undefined;

        if (!templateRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template id or name"],
            reply: "Please provide the template id or exact name to update it.",
            draft: { action, arguments: args, missingFields: ["template id or name"] }
          };
        }

        const template = await resolveTemplateByReference(templateRef);
        if (!template) {
          return { status: "failed", action, reply: `No template found for "${templateRef}".` };
        }

        const result = await templateService.update(template.id, { name: name || undefined, description, fields }, input.user.id);
        return { status: "completed", action, result, reply: `Template updated: ${result.name}.` };
      }
      case "DELETE_TEMPLATE": {
        const templateRef = normalizeText((args as any).templateRef ?? (args as any).id ?? (args as any).name);

        if (!templateRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template id or name"],
            reply: "Please provide the template id or exact name to delete it.",
            draft: { action, arguments: args, missingFields: ["template id or name"] }
          };
        }

        const template = await resolveTemplateByReference(templateRef);
        if (!template) {
          return { status: "failed", action, reply: `No template found for "${templateRef}".` };
        }

        await templateService.remove(template.id);
        return { status: "completed", action, reply: `Template deleted: ${template.name}.` };
      }
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

async function resolveTaskByReference(reference: string, user: { id: string; role: string }) {
  const trimmed = normalizeText(reference);
  if (!trimmed) {
    return { task: null as { id: string; title: string } | null, matches: [] as Array<{ id: string; title: string }> };
  }

  try {
    const task = await taskService.getById(trimmed);
    return { task: task as { id: string; title: string }, matches: [] as Array<{ id: string; title: string }> };
  } catch {
    const list = await taskService.list({ id: user.id, role: user.role as "ADMIN" | "EMPLOYEE" }, { search: trimmed, limit: 10 });
    const matches = list.items.map((item) => ({ id: item.id, title: item.title }));
    if (matches.length === 1) {
      return { task: matches[0], matches };
    }
    return { task: null, matches };
  }
}

async function resolveTemplateByReference(reference: string) {
  const trimmed = normalizeText(reference);
  if (!trimmed) {
    return null;
  }

  try {
    return await templateService.getById(trimmed);
  } catch {
    const templates = await templateService.list();
    return templates.find((template) => template.name.toLowerCase() === trimmed.toLowerCase()) ?? null;
  }
}

function formatNotificationLine(notification: { id: string; title: string; message: string; isRead: boolean; createdAt: Date | string }) {
  return `${notification.id} | ${notification.isRead ? "read" : "unread"} | ${notification.title} | ${notification.message} | ${new Date(notification.createdAt).toLocaleString("en-IN")}`;
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

  if (/(comment|reply|add comment|post comment|show comments|list comments)/.test(lower) && /task/.test(lower)) {
    const taskIdMatch = message.match(/task\s+#?([A-Za-z0-9-]+)/i);
    const commentMatch = message.match(/comment\s*[:=-]?\s*(.+)$/i);
    const isList = /show comments|list comments|view comments/.test(lower);
    return {
      action: isList ? "LIST_COMMENTS" : "ADD_COMMENT",
      arguments: {
        taskId: normalizeText(taskIdMatch?.[1]),
        comment: isList ? undefined : normalizeText(commentMatch?.[1])
      }
    };
  }

  if (/notification|notifications/.test(lower) && /(list|show|view|mark|read)/.test(lower)) {
    const notificationIdMatch = message.match(/notification\s+#?([A-Za-z0-9-]+)/i);
    if (/mark\s+all|read\s+all/.test(lower)) {
      return { action: "MARK_ALL_NOTIFICATIONS_READ" };
    }
    if (/mark|read/.test(lower) && notificationIdMatch) {
      return { action: "MARK_NOTIFICATION_READ", arguments: { notificationId: normalizeText(notificationIdMatch[1]) } };
    }
    return { action: "LIST_NOTIFICATIONS", arguments: { limit: 10 } };
  }

  if (/template|report\s+template/.test(lower) && /(list|show|create|add|update|edit|delete|remove)/.test(lower)) {
    const nameMatch = message.match(/(?:template\s+name\s*[:=-]?|template\s+)(.+)$/i);
    const templateIdMatch = message.match(/template\s+#?([A-Za-z0-9-]+)/i);
    if (/list|show/.test(lower) && !/create|add|update|edit|delete|remove/.test(lower)) {
      return { action: "LIST_TEMPLATES" };
    }
    if (/create|add/.test(lower)) {
      return {
        action: "CREATE_TEMPLATE",
        arguments: { name: normalizeText(nameMatch?.[1]) }
      };
    }
    if (/update|edit/.test(lower)) {
      return {
        action: "UPDATE_TEMPLATE",
        arguments: { templateRef: normalizeText(templateIdMatch?.[1] ?? nameMatch?.[1]) }
      };
    }
    if (/delete|remove/.test(lower)) {
      return {
        action: "DELETE_TEMPLATE",
        arguments: { templateRef: normalizeText(templateIdMatch?.[1] ?? nameMatch?.[1]) }
      };
    }
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
    "Actions: CREATE_PROJECT, CREATE_TASK, CREATE_EMPLOYEE, ADD_COMMENT, LIST_COMMENTS, LIST_PROJECTS, LIST_TASKS, LIST_NOTIFICATIONS, MARK_NOTIFICATION_READ, MARK_ALL_NOTIFICATIONS_READ, LIST_TEMPLATES, CREATE_TEMPLATE, UPDATE_TEMPLATE, DELETE_TEMPLATE, EMPLOYEE_PERFORMANCE, PENDING_TASKS_MONTH, SHOW_PENDING_TASK_DETAILS, DOWNLOAD_EMPLOYEE_REPORT, HELP, UNKNOWN.",
    "For CREATE_PROJECT arguments: name, description.",
    "For CREATE_TASK arguments: title, description, project, assignedToEmail, assignedToName, allocatedAt, allottedDays.",
    "For CREATE_EMPLOYEE arguments: name, email, password, passwordMode (AUTO|MANUAL).",
    "For ADD_COMMENT arguments: taskId, comment",
    "For LIST_COMMENTS arguments: taskId.",
    "For LIST_PROJECTS arguments: limit.",
    "For LIST_TASKS arguments: status, assignedToEmail, limit.",
    "For LIST_NOTIFICATIONS arguments: limit.",
    "For MARK_NOTIFICATION_READ arguments: notificationId.",
    "For MARK_ALL_NOTIFICATIONS_READ arguments: no fields needed.",
    "For LIST_TEMPLATES arguments: no fields needed.",
    "For CREATE_TEMPLATE arguments: name, description, fields.",
    "For UPDATE_TEMPLATE arguments: templateRef, name, description, fields.",
    "For DELETE_TEMPLATE arguments: templateRef.",
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

        const resolved = await resolveTaskByReference(taskRef, input.user);
        if (!resolved.task) {
          if (resolved.matches.length > 1) {
            const lines = resolved.matches.map((item, index) => `${index + 1}. ${item.title} (${item.id})`).slice(0, 5);
            return {
              status: "needs_input",
              action,
              missingFields: ["task id or exact task title"],
              reply: `I found multiple tasks matching "${taskRef}". Please provide the exact task id:\n${lines.join("\n")}`,
              draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
            };
          }

          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "I couldn't find a matching task. Please provide the exact task id or full task title.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const created = await commentService.create(resolved.task.id, commentBody, { id: input.user.id, role: input.user.role as any });
        return {
          status: "completed",
          action,
          result: created,
          reply: `Comment added to task: ${resolved.task.title}.`
        };
      }
      case "LIST_COMMENTS": {
        const taskRef = normalizeText((args as any).taskId ?? (args as any).task ?? (args as any).taskTitle ?? (args as any).taskSearch);

        if (!taskRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "Please provide the task id or exact task title so I can list its comments.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const resolved = await resolveTaskByReference(taskRef, input.user);
        if (!resolved.task) {
          if (resolved.matches.length > 1) {
            const lines = resolved.matches.map((item, index) => `${index + 1}. ${item.title} (${item.id})`).slice(0, 5);
            return {
              status: "needs_input",
              action,
              missingFields: ["task id or exact task title"],
              reply: `I found multiple tasks matching "${taskRef}". Please provide the exact task id:\n${lines.join("\n")}`,
              draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
            };
          }

          return {
            status: "needs_input",
            action,
            missingFields: ["task id or exact task title"],
            reply: "I couldn't find a matching task. Please provide the exact task id or full task title.",
            draft: { action, arguments: args, missingFields: ["task id or exact task title"] }
          };
        }

        const comments = await commentService.list(resolved.task.id, { id: input.user.id, role: input.user.role as any });
        if (!comments.length) {
          return { status: "completed", action, result: [], reply: `No comments found for task ${resolved.task.title}.` };
        }

        const lines = comments.map((comment, index) => `${index + 1}. ${comment.body} (${formatDate(new Date(comment.createdAt))})`);
        return {
          status: "completed",
          action,
          result: comments,
          reply: `Comments for ${resolved.task.title}:\n${lines.join("\n")}`
        };
      }
      case "LIST_NOTIFICATIONS": {
        const limit = Math.min(20, Math.max(1, toNumber((args as any).limit) ?? 10));
        const notifications = await notificationService.listForUser(input.user.id, limit);
        if (!notifications.length) {
          return { status: "completed", action, result: [], reply: "You have no notifications." };
        }

        return {
          status: "completed",
          action,
          result: notifications,
          reply: [`Here are your latest ${notifications.length} notifications:`, ...notifications.map((notification, index) => `${index + 1}. ${formatNotificationLine(notification)}`)].join("\n")
        };
      }
      case "MARK_NOTIFICATION_READ": {
        const notificationId = normalizeText((args as any).notificationId ?? (args as any).id);
        if (!notificationId) {
          return {
            status: "needs_input",
            action,
            missingFields: ["notification id"],
            reply: "Please provide the notification id to mark it as read.",
            draft: { action, arguments: args, missingFields: ["notification id"] }
          };
        }

        const result = await notificationService.markRead(notificationId, input.user.id);
        return {
          status: "completed",
          action,
          result,
          reply: result.updated ? "Notification marked as read." : "No matching notification was found."
        };
      }
      case "MARK_ALL_NOTIFICATIONS_READ": {
        const result = await notificationService.markAllRead(input.user.id);
        return {
          status: "completed",
          action,
          result,
          reply: result.updated ? `Marked ${result.updated} notification(s) as read.` : "You had no unread notifications."
        };
      }
      case "LIST_TEMPLATES": {
        const templates = await templateService.list();
        if (!templates.length) {
          return { status: "completed", action, result: [], reply: "No templates found." };
        }

        const lines = templates.map((template, index) => `${index + 1}. ${template.name}${template.description ? ` - ${template.description}` : ""}`);
        return {
          status: "completed",
          action,
          result: templates,
          reply: `Here are the available templates:\n${lines.join("\n")}`
        };
      }
      case "CREATE_TEMPLATE": {
        const name = normalizeText((args as any).name);
        const description = normalizeText((args as any).description) || undefined;
        const fields = Array.isArray((args as any).fields) ? (args as any).fields : [];

        if (!name) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template name"],
            reply: "Please provide the template name to create it.",
            draft: { action, arguments: args, missingFields: ["template name"] }
          };
        }

        const existing = await templateService.list();
        const duplicate = existing.find((template) => template.name.toLowerCase() === name.toLowerCase());
        if (duplicate) {
          return { status: "failed", action, reply: `A template named "${name}" already exists.` };
        }

        const result = await templateService.create({ name, description, fields }, input.user.id);
        return { status: "completed", action, result, reply: `Template created: ${result.name}.` };
      }
      case "UPDATE_TEMPLATE": {
        const templateRef = normalizeText((args as any).templateRef ?? (args as any).id ?? (args as any).name);
        const name = normalizeText((args as any).name);
        const description = normalizeText((args as any).description) || undefined;
        const fields = Array.isArray((args as any).fields) ? (args as any).fields : undefined;

        if (!templateRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template id or name"],
            reply: "Please provide the template id or exact name to update it.",
            draft: { action, arguments: args, missingFields: ["template id or name"] }
          };
        }

        const template = await resolveTemplateByReference(templateRef);
        if (!template) {
          return { status: "failed", action, reply: `No template found for "${templateRef}".` };
        }

        const result = await templateService.update(template.id, { name: name || undefined, description, fields }, input.user.id);
        return { status: "completed", action, result, reply: `Template updated: ${result.name}.` };
      }
      case "DELETE_TEMPLATE": {
        const templateRef = normalizeText((args as any).templateRef ?? (args as any).id ?? (args as any).name);

        if (!templateRef) {
          return {
            status: "needs_input",
            action,
            missingFields: ["template id or name"],
            reply: "Please provide the template id or exact name to delete it.",
            draft: { action, arguments: args, missingFields: ["template id or name"] }
          };
        }

        const template = await resolveTemplateByReference(templateRef);
        if (!template) {
          return { status: "failed", action, reply: `No template found for "${templateRef}".` };
        }

        await templateService.remove(template.id);
        return { status: "completed", action, reply: `Template deleted: ${template.name}.` };
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
