# Sankalp Chatbot Implementation Guide

This document explains exactly what was added for the website-wide chatbot, why each file was changed, and how to run it.

## 1. What the chatbot now does

The chatbot is available on every authenticated app page (admin and employee areas) and can:

- Create a project
- Create a task
- Add a team member (employee)
- List projects
- List tasks
- Ask for missing required details before creating anything

Examples:

- "Create project NH-848 package 3"
- "Create task Soil test for project NH848 and assign to user@company.com for 3 days"
- "Add team member Rahul with email rahul@x.com and generate password"

If required inputs are missing, it returns a prompt like:

- "Please provide: task title, project name, allotted days"

## 2. Backend changes

### 2.1 Environment variables

File changed:

- `backend/src/config/env.ts`

Added env vars:

- `GROQ_API` (optional) - your Groq API key from Render env
- `GROQ_MODEL` (default: `llama-3.3-70b-versatile`)

Behavior:

- If `GROQ_API` is present, the assistant uses Groq for intent parsing.
- If not present/unavailable, it uses a built-in fallback parser.

### 2.2 New assistant validation schema

File added:

- `backend/src/validators/assistant.validator.ts`

Validates POST body for chatbot:

- `message` (required string)
- `conversation` (optional recent chat history)

### 2.3 New assistant route

File added:

- `backend/src/routes/assistant.routes.ts`

Endpoint:

- `POST /assistant/chat`

Security:

- Authenticated route (`requireAuth`)

### 2.4 New assistant controller

File added:

- `backend/src/controllers/assistant.controller.ts`

Purpose:

- Handles request/response
- Calls assistant service and returns standardized success response

### 2.5 New assistant service (core logic)

File added:

- `backend/src/services/assistant.service.ts`

Core responsibilities:

1. Parse intent and arguments from message (Groq or fallback)
2. Validate missing required fields
3. Execute domain actions through existing services
4. Return user-friendly result text and status

Supported actions:

- `CREATE_PROJECT`
- `CREATE_TASK`
- `CREATE_EMPLOYEE`
- `LIST_PROJECTS`
- `LIST_TASKS`
- `HELP`

Important rules implemented:

- Admin-only enforcement for create operations
- Missing field prompts before execution
- Employee assignment resolution by email or unique name match
- Auto password generation for employee creation when requested

### 2.6 Router registration

File changed:

- `backend/src/routes/index.ts`

Added:

- `apiRouter.use("/assistant", assistantRouter);`

## 3. Frontend changes

### 3.1 New domain types for assistant chat

File changed:

- `frontend/src/lib/domain.ts`

Added types:

- `AssistantConversationMessage`
- `AssistantChatResponse`

### 3.2 API client method for chatbot

File changed:

- `frontend/src/lib/api.ts`

Added method:

- `api.chatAssistant({ message, conversation })`

Calls backend:

- `POST /assistant/chat`

### 3.3 New floating chatbot UI component

File added:

- `frontend/src/components/ChatAssistant.tsx`

Features:

- Floating button at bottom-right
- Opens chat panel
- Sends user prompt to assistant API
- Shows assistant response
- Displays generated credentials when team member is auto-created
- Enter to send, Shift+Enter for new line

### 3.4 Make chatbot visible on every app page

File changed:

- `frontend/src/components/AppLayout.tsx`

Added:

- `<ChatAssistant />` at layout level so it is present site-wide in authenticated pages.

## 4. How missing information handling works

Before creating records, chatbot checks required fields.

Examples:

- Create project requires: `name`
- Create task requires: `title`, `project`, `assigned employee`, `allottedDays`, `start date`
- Create employee requires: `name`, `email`, and password (or auto-generate mode)

If fields are missing, response status is `needs_input`, and chatbot asks the user to provide those fields.

## 5. Deployment setup (Render)

In Render backend service env variables, set:

- `GROQ_API=your_groq_api_key`
- (Optional) `GROQ_MODEL=llama-3.3-70b-versatile`

No frontend env changes are required for this feature.

## 6. Build/verification status

- Frontend build passes with chatbot integration.
- Backend compile was fixed for assistant type issues and integrated into existing services.

## 7. File summary (all chatbot-related changes)

Added:

- `backend/src/validators/assistant.validator.ts`
- `backend/src/routes/assistant.routes.ts`
- `backend/src/controllers/assistant.controller.ts`
- `backend/src/services/assistant.service.ts`
- `frontend/src/components/ChatAssistant.tsx`
- `CHATBOT_IMPLEMENTATION.md`

Updated:

- `backend/src/config/env.ts`
- `backend/src/routes/index.ts`
- `frontend/src/lib/domain.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/components/AppLayout.tsx`

## 8. Next improvements (optional)

If you want this to truly control all modules in one chat, next extensions are:

- Add actions for reports, templates, project-number assignment, requisition forms, and financial bill workflows.
- Add confirmation mode before destructive operations.
- Add audit log entry for each assistant-triggered action.
- Add chat history persistence per user.
