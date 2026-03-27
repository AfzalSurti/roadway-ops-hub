# HighwayOps Hub

## About

HighwayOps Hub is a web-based **task and report management platform** for highway/construction operations teams. It helps admins assign and track field work, and helps employees submit structured daily reports from assigned tasks.

## Description

This project is designed to replace manual tracking (spreadsheets/messages) with one centralized workflow:

- Admins create projects, tasks, templates, and employee accounts.
- Employees receive assigned tasks and submit report data using templates.
- Teams can monitor progress, overdue work, submissions, and project-level status from dashboards.
- Authentication and role-based access ensure secure admin/employee separation.

## Tech Stack

Full-stack HighwayOps application with:

- **Frontend**: React + Vite + Tailwind (now under `frontend/`)
- **Backend**: Node.js + Express + Prisma + PostgreSQL (Neon) (under `backend/`)
- **Auth**: JWT access + refresh tokens
- **Roles**: `ADMIN`, `EMPLOYEE`

---

## Project Structure

```txt
frontend/                                  # Vite + React client application
|- components.json                         # shadcn/ui component registry config
|- index.html                              # HTML entry file used by Vite
|- postcss.config.js                       # PostCSS plugin configuration
|- tailwind.config.cjs                     # CommonJS Tailwind config variant
|- tailwind.config.js                      # JavaScript Tailwind config variant
|- tailwind.config.ts                      # TypeScript Tailwind config variant
|- tsconfig.app.json                       # TypeScript config for app source
|- tsconfig.node.json                      # TypeScript config for Vite/node files
|- vite.config.ts                          # Main Vite build/dev server config
|- vite.config.ts.timestamp-*.mjs          # Temporary/generated Vite timestamp files
|- vitest.config.ts                        # Vitest test runner configuration
|- public/                                 # Static assets served as-is
|  |- favicon.ico                          # Browser tab icon
|  |- landing-feature-1.svg                # Landing page feature illustration
|  |- landing-feature-2.svg                # Landing page feature illustration
|  |- landing-hero.svg                     # Landing page hero illustration
|  |- placeholder.svg                      # Generic placeholder graphic
|  |- roadway-logo.svg                     # Main product logo
|  \- robots.txt                           # Search crawler rules
\- src/                                    # Frontend application source
   |- App.css                              # Root app-level styles
   |- App.tsx                              # Top-level app component and routing shell
   |- index.css                            # Global styles and Tailwind imports
   |- main.tsx                             # React bootstrap entry point
   |- vite-env.d.ts                        # Vite TypeScript type declarations
   |- components/                          # Shared layout and feature components
   |  |- AppLayout.tsx                     # Main authenticated app layout wrapper
   |  |- AppSidebar.tsx                    # Sidebar navigation container
   |  |- ChatAssistant.tsx                 # In-app assistant/chat UI
   |  |- NavLink.tsx                       # Reusable navigation link component
   |  |- PageWrapper.tsx                   # Standard page spacing/header wrapper
   |  |- SidebarNavItem.tsx                # Sidebar item renderer
   |  |- TopBar.tsx                        # Top header bar component
   |  \- ui/                               # Reusable low-level UI primitives
   |     |- accordion.tsx                  # Expand/collapse accordion UI
   |     |- alert-dialog.tsx               # Modal confirm/cancel dialog
   |     |- alert.tsx                      # Inline alert/banner component
   |     |- aspect-ratio.tsx               # Fixed aspect-ratio container
   |     |- avatar.tsx                     # User avatar component
   |     |- badge.tsx                      # Status/label badge component
   |     |- breadcrumb.tsx                 # Breadcrumb navigation component
   |     |- button.tsx                     # Reusable button variants
   |     |- calendar.tsx                   # Calendar/date picker UI
   |     |- card.tsx                       # Card container component
   |     |- carousel.tsx                   # Carousel/slider wrapper
   |     |- chart.tsx                      # Chart display helpers
   |     |- checkbox.tsx                   # Checkbox input component
   |     |- collapsible.tsx                # Generic collapsible panel
   |     |- command.tsx                    # Command menu/palette UI
   |     |- context-menu.tsx               # Right-click context menu UI
   |     |- dialog.tsx                     # Generic modal dialog UI
   |     |- drawer.tsx                     # Slide-up/slide-out drawer UI
   |     |- dropdown-menu.tsx              # Dropdown actions menu
   |     |- form.tsx                       # Form field helpers/integration
   |     |- hover-card.tsx                 # Hover preview card UI
   |     |- input-otp.tsx                  # OTP/pin code input component
   |     |- input.tsx                      # Text input component
   |     |- label.tsx                      # Form label component
   |     |- menubar.tsx                    # Desktop-style menubar UI
   |     |- navigation-menu.tsx            # Structured navigation menu UI
   |     |- pagination.tsx                 # Pagination controls
   |     |- popover.tsx                    # Popover/floating panel UI
   |     |- progress.tsx                   # Progress bar component
   |     |- radio-group.tsx                # Radio button group component
   |     |- resizable.tsx                  # Resizable panel layout UI
   |     |- scroll-area.tsx                # Custom scroll container
   |     |- select.tsx                     # Select/dropdown field component
   |     |- separator.tsx                  # Visual divider component
   |     |- sheet.tsx                      # Off-canvas sheet/panel UI
   |     |- sidebar.tsx                    # Sidebar primitive helpers
   |     |- skeleton.tsx                   # Loading skeleton placeholder UI
   |     |- slider.tsx                     # Range slider component
   |     |- sonner.tsx                     # Sonner toast integration
   |     |- switch.tsx                     # Toggle switch component
   |     |- table.tsx                      # Table layout primitives
   |     |- tabs.tsx                       # Tab navigation component
   |     |- textarea.tsx                   # Multiline text input
   |     |- toast.tsx                      # Toast UI component
   |     |- toaster.tsx                    # Toast container/manager
   |     |- toggle-group.tsx               # Grouped toggle buttons
   |     |- toggle.tsx                     # Single toggle button
   |     |- tooltip.tsx                    # Hover tooltip component
   |     \- use-toast.ts                   # Toast state helper hook
   |- hooks/                               # Custom React hooks
   |  |- use-mobile.tsx                    # Mobile breakpoint detection hook
   |  |- use-persistent-state.ts           # State synced with local storage
   |  \- use-toast.ts                      # App-level toast helper hook
   |- lib/                                 # Shared utilities and domain helpers
   |  |- api.ts                            # Frontend API client utilities
   |  |- auth.tsx                          # Auth context and auth helpers
   |  |- domain.ts                         # Domain constants/types/helpers
   |  |- project-plan-template.ts          # Project plan template definitions
   |  |- project-requisition-pdf.ts        # Project requisition PDF generator
   |  |- ra-bill-pdf.ts                    # RA bill PDF generator
   |  |- reports-pdf.ts                    # Report PDF export generator
   |  \- utils.ts                          # General shared utility functions
   |- pages/                               # Route-level page components
   |  |- Index.tsx                         # Landing or home page
   |  |- Login.tsx                         # Login screen
   |  |- NotFound.tsx                      # 404 fallback page
   |  |- admin/                            # Admin-only pages
   |  |  |- CreateTask.tsx                 # Admin task creation page
   |  |  |- Dashboard.tsx                  # Admin dashboard overview
   |  |  |- Financial.tsx                  # Admin financial management page
   |  |  |- Projects.tsx                   # Admin project management page
   |  |  |- Reports.tsx                    # Admin reports review page
   |  |  |- Tasks.tsx                      # Admin task list page
   |  |  |- Team.tsx                       # Admin team/user management page
   |  |  \- Templates.tsx                  # Admin report/template management page
   |  \- employee/                         # Employee-facing pages
   |     |- Dashboard.tsx                  # Employee dashboard overview
   |     |- Profile.tsx                    # Employee profile page
   |     |- Reports.tsx                    # Employee submitted reports page
   |     |- TaskDetail.tsx                 # Employee task detail view
   |     \- Tasks.tsx                      # Employee assigned tasks list
   \- test/                                # Frontend test setup and samples
      |- example.test.ts                   # Example unit test
      \- setup.ts                          # Test environment setup
```

```txt
backend/                                   # Express + Prisma API server
|- tsconfig.json                           # TypeScript config for backend
\- src/                                    # Backend application source
   |- app.ts                               # Express app setup and middleware wiring
   |- server.ts                            # HTTP server startup entry point
   |- config/                              # Runtime configuration helpers
   |  |- env.ts                            # Environment variable parsing/validation
   |  \- logger.ts                         # Logging configuration/helpers
   |- controllers/                         # Route controllers handling requests
   |  |- assistant.controller.ts           # Assistant endpoint controller
   |  |- auth.controller.ts                # Login/refresh/logout controller
   |  |- comment.controller.ts             # Comment CRUD controller
   |  |- financial.controller.ts           # Financial module controller
   |  |- notification.controller.ts        # Notification endpoint controller
   |  |- project-requisition-form.controller.ts # Project requisition form controller
   |  |- project.controller.ts             # Project CRUD controller
   |  |- report.controller.ts              # Report submission/review controller
   |  |- task.controller.ts                # Task CRUD and assignment controller
   |  |- template.controller.ts            # Template CRUD controller
   |  |- upload.controller.ts              # File upload controller
   |  \- user.controller.ts                # User/team management controller
   |- middleware/                          # Express middleware layer
   |  |- auth.ts                           # JWT auth middleware
   |  |- error-handler.ts                  # Central error response middleware
   |  |- not-found.ts                      # 404 handler middleware
   |  |- rate-limit.ts                     # Request throttling middleware
   |  |- rbac.ts                           # Role-based access control middleware
   |  |- upload.ts                         # Multer/upload middleware config
   |  \- validate.ts                       # Request body/query validation middleware
   |- prisma/                              # Prisma integration helpers
   |  \- client.ts                         # Shared Prisma client instance
   |- repositories/                        # Data-access layer for database queries
   |  |- attachment.repository.ts          # Attachment persistence queries
   |  |- audit.repository.ts               # Audit log persistence queries
   |  |- comment.repository.ts             # Comment persistence queries
   |  |- financial.repository.ts           # Financial persistence queries
   |  |- notification.repository.ts        # Notification persistence queries
   |  |- project-requisition-form.repository.ts # Requisition form queries
   |  |- project.repository.ts             # Project persistence queries
   |  |- refresh-token.repository.ts       # Refresh token storage queries
   |  |- report.repository.ts              # Report persistence queries
   |  |- task.repository.ts                # Task persistence queries
   |  |- template.repository.ts            # Template persistence queries
   |  \- user.repository.ts                # User persistence queries
   |- routes/                              # Express route definitions
   |  |- assistant.routes.ts               # Assistant API routes
   |  |- auth.routes.ts                    # Authentication routes
   |  |- financial.routes.ts               # Financial routes
   |  |- index.ts                          # Root router that mounts all routes
   |  |- notifications.routes.ts           # Notification routes
   |  |- project-requisition-forms.routes.ts # Requisition form routes
   |  |- projects.routes.ts                # Project routes
   |  |- reports.routes.ts                 # Report routes
   |  |- tasks.routes.ts                   # Task routes
   |  |- templates.routes.ts               # Template routes
   |  |- uploads.routes.ts                 # Upload routes
   |  \- users.routes.ts                   # User routes
   |- scripts/                             # Utility scripts run from CLI
   |  |- bootstrap-admin-env.ts            # Reads env for admin bootstrap
   |  \- bootstrap-admin.ts                # Seeds the first admin user
   |- services/                            # Business logic layer
   |  |- assistant.service.ts              # Assistant business logic
   |  |- audit.service.ts                  # Audit event business logic
   |  |- auth.service.ts                   # Authentication/token logic
   |  |- comment.service.ts                # Comment business logic
   |  |- dpr-activity.service.ts           # DPR activity helper logic
   |  |- email.service.ts                  # Email sending/service wrapper
   |  |- financial.service.ts              # Financial business logic
   |  |- notification.service.ts           # Notification business logic
   |  |- project-requisition-form.service.ts # Requisition form business logic
   |  |- project.service.ts                # Project business logic
   |  |- report.service.ts                 # Report business logic
   |  |- task.service.ts                   # Task business logic
   |  |- template.service.ts               # Template business logic
   |  |- upload.service.ts                 # Upload/file handling logic
   |  \- user.service.ts                   # User management logic
   |- types/                               # Shared backend type augmentations
   |  \- express.d.ts                      # Express request typing extensions
   |- utils/                               # Reusable backend utility helpers
   |  |- async-handler.ts                  # Async route error wrapper
   |  |- errors.ts                         # Custom error classes/helpers
   |  |- jwt.ts                            # JWT sign/verify helpers
   |  |- pagination.ts                     # Pagination utility helpers
   |  |- password.ts                       # Password hashing/comparison helpers
   |  \- response.ts                       # Standard API response helpers
   \- validators/                          # Request validation schemas/rules
      |- assistant.validator.ts            # Assistant request validation
      |- auth.validator.ts                 # Auth request validation
      |- comment.validator.ts              # Comment request validation
      |- project-requisition-form.validator.ts # Requisition form validation
      |- project.validator.ts              # Project request validation
      |- report.validator.ts               # Report request validation
      |- task-complete.validator.ts        # Task completion validation
      |- task.validator.ts                 # Task request validation
      |- template.validator.ts             # Template request validation
      \- user.validator.ts                 # User request validation
```

---

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create root `.env` from `.env.example` and set values.

### 3) Run database migration

```bash
npx prisma migrate dev
```

### 4) Create first admin (if DB is empty)

```bash
npm run bootstrap:admin -- --email=admin@highwayops.com --password=Admin@123 --name="Admin User"
```

### 5) Run backend + frontend

Option A (one command on Windows):

```powershell
.\run-project.ps1
```

Option B (separate terminals):

```bash
npm run dev            # backend on 4000
npm run dev:frontend   # frontend on 8080 (or passed port)
```

---

## Deployment Target

- **Frontend** -> **Vercel**
- **Backend** -> **Render**

---

## Step-by-Step: Deploy Backend on Render

### 1) Create Render Web Service

1. Push code to GitHub.
2. In Render: **New +** -> **Web Service**.
3. Select your repository.
4. Use these settings:
   - **Root Directory**: leave empty (`.`)
   - **Build Command**:
     ```bash
     npm install && npm run build:backend && npx prisma migrate deploy
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```

### 2) Create Neon PostgreSQL database

1. Create a free database in Neon.
2. Copy the pooled connection string.
3. In Render env vars, set:
   - `DATABASE_URL=<your-neon-connection-string>`

### 3) Configure backend environment variables

Set these in Render **Environment**:

- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL=<your-neon-connection-string>`
- `JWT_ACCESS_SECRET=<strong-random-secret>`
- `JWT_REFRESH_SECRET=<strong-random-secret>`
- `JWT_ACCESS_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `BCRYPT_SALT_ROUNDS=10`
- `CORS_ORIGIN=https://<your-vercel-domain>`

### 4) Create first admin in production

After first successful deploy, open Render shell and run:

```bash
npm run bootstrap:admin -- --email=<admin-email> --password=<strong-password> --name="Admin"
```

### 5) Confirm backend

Open:

```txt
https://<your-render-service>.onrender.com/health
```

Should return `{"success":true,...}`.

---

## Step-by-Step: Deploy Frontend on Vercel

### 1) Create Vercel project

1. In Vercel: **Add New Project**.
2. Import the same repository.
3. Keep **Root Directory** as repository root (`.`).

### 2) Build settings

Use:

- **Install Command**: `npm install`
- **Build Command**: `npm run build:frontend`
- **Output Directory**: `frontend/dist`

(`vercel.json` in repo already sets build + SPA rewrites.)

### 3) Add frontend environment variable

In Vercel project settings -> Environment Variables:

- `VITE_API_URL=https://<your-render-service>.onrender.com`

Redeploy after setting env vars.

### 4) Confirm frontend

Open your Vercel domain and verify login + API calls work.

---

## Deployment Checklist

- Render `/health` is reachable.
- Vercel `VITE_API_URL` points to Render backend URL.
- Render `CORS_ORIGIN` includes exact Vercel domain.
- Admin login works in deployed app.
- Task/template/project APIs return success.

---

## Useful Commands

```bash
npm run build
npm run build:frontend
npm run build:backend
npm run dev
npm run dev:frontend
npm test
```

---

## Notes

- Neon PostgreSQL is recommended for Render free tier persistence.
- `uploads/` on ephemeral filesystem may not persist unless redirected to persistent storage (S3/R2 recommended for production files).
