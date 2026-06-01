# Roadway Ops Hub - Project Analysis

Date: 2026-06-01

## Project Overview

Roadway Ops Hub is a full-stack TypeScript web application for roadway/highway operations. It supports role-based workflows for admins, PMO/administrative users, HOD users, and employees. The product covers task assignment, task review, report templates and submissions, projects, project numbering, requisition forms, financial planning/RA bills, asset management, DPR overview tracking, notifications, uploads, and an assistant/chat feature.

Existing note: the user requested reading `PRODUCT_ANALYSIS.md`, but that file is not present in the repository. This analysis uses the current repository plus the existing `PROJECT_ANALYSIS.md` content as context.

## Tech Stack Summary

- Frontend framework: React 18 + TypeScript + Vite.
- Frontend routing/state: React Router, TanStack React Query, local React context for auth.
- UI system: Tailwind CSS, shadcn/ui-style components, Radix UI primitives, lucide-react icons, Sonner/toast components, Recharts, framer-motion.
- Backend framework: Node.js + Express + TypeScript using ESM/NodeNext.
- Database: Prisma ORM with PostgreSQL provider in `prisma/schema.prisma`.
- Development database note: backend has runtime SQLite PRAGMA support when `DATABASE_URL` starts with `file:`, but the Prisma schema provider is currently `postgresql`; SQLite is not the declared schema provider.
- Authentication: JWT access tokens and JWT refresh tokens. Refresh tokens are hashed before storage in the `RefreshToken` table.
- Validation: Zod for environment and request validation.
- Email: Resend and/or Gmail SMTP through nodemailer-style config.
- Package manager: npm is the active package manager (`package-lock.json`, scripts use npm). A `bun.lockb` also exists, but npm is the documented and configured path.
- Testing: Vitest + jsdom + React Testing Library setup; only minimal/example frontend test coverage is visible.
- Deployment: Render for backend (`render.yaml`) and Vercel for frontend (`vercel.json`).

## Folder-by-Folder Explanation

### Root

- `package.json`: root scripts and shared dependencies for frontend, backend, Prisma, tests, and builds.
- `package-lock.json`: npm lockfile.
- `bun.lockb`: Bun lockfile, likely historical or alternate tooling.
- `.env.example`: documented environment variables.
- `.env`: local environment file exists in working tree and is ignored by `.gitignore`.
- `.gitignore`: ignores `.env`, `node_modules`, build outputs, logs, and local SQLite files.
- `README.md`: setup, project structure, deployment notes.
- `render.yaml`: Render backend service config.
- `vercel.json`: Vercel frontend build and SPA rewrite config.
- `run-project.ps1`: Windows helper that installs dependencies if needed, stops listeners on configured ports, then starts backend and frontend in separate PowerShell windows.
- `eslint.config.js`: flat ESLint config for TypeScript/React hooks/React refresh.
- `tsconfig.json`: root TS references and frontend alias settings.
- CSV files: source/business data inputs such as task reviews, DPR activity, and bar chart data.
- `CHATBOT_IMPLEMENTATION.md`: assistant feature documentation.
- `build.log`, `frontend-build.log`: local build logs.

### `frontend/`

- Vite React app root.
- `index.html`: Vite HTML entry.
- `vite.config.ts`: Vite root is `frontend`, dev server defaults to port `8080`, alias `@` maps to `frontend/src`, and Lovable component tagger is enabled in development.
- `vitest.config.ts`: frontend tests run in jsdom with `src/test/setup.ts`.
- `tailwind.config.cjs`, `tailwind.config.ts`, `tailwind.config.js`: multiple Tailwind config variants exist; Vite explicitly uses `tailwind.config.cjs`.
- `components.json`: shadcn/ui configuration and aliases.
- `public/`: static assets including logo, landing SVGs, favicon, placeholder, robots file.
- `src/main.tsx`: React bootstrap entry point.
- `src/App.tsx`: app providers, query client, router, role guards, and top-level route table.
- `src/index.css` and `src/App.css`: global styles and Tailwind CSS.
- `src/components/`: shared layout and feature components.
- `src/components/ui/`: shadcn/Radix-style reusable UI primitives.
- `src/pages/`: route-level screens split by role (`admin`, `administrative`, `hod`, `employee`) plus landing/login/not-found.
- `src/lib/`: API client, auth helpers, domain types/configs, PDF/export utilities, asset catalog, project templates.
- `src/hooks/`: reusable React hooks for mobile detection, persistent state, and toasts.
- `src/test/`: Vitest setup and example test.

### `backend/`

- Express API server root.
- `src/server.ts`: backend runtime entry; connects Prisma, configures DB, starts Express on `env.PORT`.
- `src/app.ts`: Express app setup; logging, helmet, CORS, body parsing, `/health`, `/send-mail`, static `/uploads`, API router mount, 404 and error middleware.
- `src/config/`: environment parsing and pino logger setup.
- `src/routes/`: REST route modules mounted from `routes/index.ts`.
- `src/controllers/`: request handlers that call services and send standard responses.
- `src/services/`: business logic layer for auth, task, report, project, financial, assistant, asset, notifications, DPR overview, etc.
- `src/repositories/`: Prisma data-access layer.
- `src/middleware/`: auth, RBAC, validation, upload, rate limiting, 404, error handler.
- `src/utils/`: JWT, password hashing, pagination, responses, error helpers, depreciation, async handler.
- `src/validators/`: Zod request schemas.
- `src/scripts/`: bootstrap admin/administrative users and database wipe helper.
- `src/types/express.d.ts`: Express request user typing extension.

### `prisma/`

- `schema.prisma`: database schema and Prisma client generator.
- `migrations/`: historical migrations including initial schema, projects, user education year, financial/RA bills, duplicate project numbers, asset management, and PMO role.
- `sql/`: manual SQL helpers for HOD credentials, DPR migration, and asset sale details.
- `dev.db.backup-*`: local SQLite backup file, despite current Prisma provider being PostgreSQL.

## Main Entry Points

- Frontend application entry: `frontend/src/main.tsx`.
- Frontend routing and providers: `frontend/src/App.tsx`.
- Frontend API layer: `frontend/src/lib/api.ts`.
- Frontend auth context: `frontend/src/lib/auth.tsx`.
- Backend runtime entry: `backend/src/server.ts`.
- Backend Express setup: `backend/src/app.ts`.
- Backend router index: `backend/src/routes/index.ts`.
- Backend environment config: `backend/src/config/env.ts`.
- Prisma schema: `prisma/schema.prisma`.

## Architecture and Data Flow

1. Browser loads the Vite-built React app.
2. `main.tsx` mounts `App`.
3. `App.tsx` wraps the app with React Query, Tooltip, toaster providers, `AuthProvider`, and `BrowserRouter`.
4. Role guards in `App.tsx` route users to:
   - `ADMIN`: `/admin/dashboard`
   - `PMO`: `/administrative/dashboard`
   - `HOD`: `/hod/dashboard`
   - `EMPLOYEE`: `/app/dashboard`
5. Pages call methods on `frontend/src/lib/api.ts`.
6. The API client reads `VITE_API_URL`, defaults to `http://localhost:4000`, attaches `Authorization: Bearer <accessToken>`, and retries once with `/api` prefix on 404 for deployment compatibility.
7. On a 401, the API client posts the refresh token to `/auth/refresh`, stores the new access token, and retries the original request.
8. Backend `app.ts` applies CORS, helmet, logging, parsers, static uploads, and mounts routers at root paths such as `/auth`, `/tasks`, `/projects`.
9. Protected routes use `requireAuth`, which verifies the access JWT and writes `req.user`.
10. RBAC middleware checks roles with `requireRole`; some task/report routes use `allowSelfOrAdmin`.
11. Controllers delegate business logic to services.
12. Services call repositories.
13. Repositories use Prisma to read/write the database.
14. Responses are returned in a standard `{ success, data }` or `{ success, error }` shape.

## Database Model Summary

Core Prisma models:

- `User`: users with role, profile fields, tasks, reports, comments, attachments, refresh tokens, audit logs, notifications.
- `RefreshToken`: hashed refresh tokens with expiry and revocation.
- `ReportTemplate`: dynamic report field definitions.
- `Project`: project identity, project number metadata, requisition, financial plan, DPR overview.
- `ProjectRequisitionForm`: detailed client/work-order/project requisition data.
- `Task`: assigned work item with priority, dates, status, review metadata, rating, assignee, creator, template.
- `Report`: employee report submission with template snapshot and review status.
- `Attachment`: uploaded file metadata linked to tasks/reports/users.
- `Comment`: task comments.
- `AuditLog`: audit events.
- `ProjectFinancialPlan`, `ProjectFinancialItem`, `ProjectFinancialRaBill`, `ProjectFinancialCarryForward`, `ProjectFinancialBill`: financial planning and RA bill workflow.
- `Notification`: per-user notifications.
- `Asset`, `AssetMovement`, `AssetMaintenance`: asset registry and lifecycle tracking.
- `ProjectDprOverview`: project DPR status and JSON data.

Enums include `Role`, `TaskStatus`, `Priority`, `ReportStatus`, `FinancialBillStatus`, `FinancialPlanningType`, `AssetStatus`, `DprReportStatus`, and `AuditAction`.

## APIs

Routes are mounted directly at backend root, not under `/api`.

- `/health`: public health check.
- `/send-mail`: public/simple mail endpoint requiring `email` in body.
- `/auth`: login, refresh, logout; rate-limited.
- `/tasks`: task CRUD, DPR activity list, completion, approval, request changes, comment acknowledgement, comments.
- `/templates`: report template management, admin-only.
- `/reports`: employee submission, report listing, report details, admin status/feedback updates.
- `/uploads`: authenticated upload handling.
- `/users`: authenticated profile routes plus admin employee/team routes.
- `/projects`: project listing, create/update/delete, numbering options, preview, assign project number.
- `/project-requisition-forms`: admin requisition form list/get/upsert.
- `/financials`: admin financial project list, project financial detail, plan upsert, RA bill create/update, all-project bill status.
- `/notifications`: authenticated notification list and read-state updates.
- `/assistant`: authenticated assistant chat.
- `/assets`: PMO/admin asset list/detail/stats/create/update/movement/maintenance; delete is PMO-only.
- `/dpr-overviews`: ADMIN/PMO/HOD DPR overview list/get/create/update/delete.

## Authentication and Authorization

- Login endpoint: `POST /auth/login`.
- Refresh endpoint: `POST /auth/refresh`.
- Logout endpoint: `POST /auth/logout`.
- Access token: JWT signed with `JWT_ACCESS_SECRET`.
- Refresh token: JWT signed with `JWT_REFRESH_SECRET`, then hashed with SHA-256 before database storage.
- Frontend storage: access token, refresh token, and user object are stored in `localStorage`.
- Backend auth middleware: `backend/src/middleware/auth.ts`.
- Backend RBAC middleware: `backend/src/middleware/rbac.ts`.
- Frontend route guards: `ProtectedRoute`, `AdminRoute`, `PmoRoute`, `HodRoute`, `EmployeeRoute` in `frontend/src/App.tsx`.
- Roles currently implemented: `ADMIN`, `PMO`, `HOD`, `EMPLOYEE`.

## Environment Variables

Validated in `backend/src/config/env.ts`:

- `NODE_ENV`: `development`, `test`, or `production`; default `development`.
- `PORT`: backend port; default `4000`.
- `DATABASE_URL`: required.
- `JWT_ACCESS_SECRET`: required, minimum 16 chars.
- `JWT_REFRESH_SECRET`: required, minimum 16 chars.
- `JWT_ACCESS_EXPIRES_IN`: default `15m`.
- `JWT_REFRESH_EXPIRES_IN`: default `7d`.
- `BCRYPT_SALT_ROUNDS`: default `10`, min `8`, max `14`.
- `CORS_ORIGIN`: comma-separated allowed origins; default `http://localhost:5173`.
- `SQLITE_BUSY_TIMEOUT_MS`: default `5000`.
- `GMAIL`: optional SMTP email account.
- `APP_PASSWORD`: optional Gmail app password; whitespace stripped.
- `RESEND_API_KEY`: optional Resend key.
- `EMAIL_FROM`: optional sender.
- `APP_URL`: optional URL used by email/app flows.
- `GROQ_API`: optional assistant model API key.
- `GROQ_MODEL`: default `llama-3.3-70b-versatile`.

Frontend:

- `VITE_API_URL`: API base URL; defaults in code to `http://localhost:4000`.

Render-specific env vars in `render.yaml`:

- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME`, `FORCE_BOOTSTRAP_ADMIN`.
- `BOOTSTRAP_ADMINISTRATIVE_EMAIL`, `BOOTSTRAP_ADMINISTRATIVE_PASSWORD`, `BOOTSTRAP_ADMINISTRATIVE_NAME`, `FORCE_BOOTSTRAP_ADMINISTRATIVE`.

## Important Configs

- `frontend/vite.config.ts`: Vite root, dev port, aliases, Tailwind/PostCSS setup, React SWC, Lovable tagger in development.
- `frontend/vitest.config.ts`: jsdom test config.
- `frontend/components.json`: shadcn/ui aliases and component config.
- `frontend/tailwind.config.cjs`: active Tailwind config used by Vite.
- `backend/tsconfig.json`: strict NodeNext backend TypeScript build to `backend/dist`.
- `tsconfig.json`: frontend references and relaxed TS options.
- `eslint.config.js`: TypeScript recommended rules, React hooks, React refresh; unused vars disabled.
- `render.yaml`: backend build/start for Render.
- `vercel.json`: frontend Vercel build output and SPA rewrites.

## Build and Deployment Setup

Scripts from `package.json`:

- `npm run dev`: backend dev server via `tsx watch backend/src/server.ts`.
- `npm run dev:frontend`: Vite frontend dev server.
- `npm run build`: frontend build then backend build.
- `npm run build:frontend`: Vite build using frontend config.
- `npm run build:backend`: TypeScript backend compile.
- `npm start`: runs compiled backend `backend/dist/server.js`.
- `npm run start:render`: runs `prisma db push --accept-data-loss`, bootstraps admin and administrative users from env, then starts backend.
- `npm run prisma:migrate`: runs `prisma migrate dev`.
- `npm run bootstrap:admin`: creates initial admin.
- `npm run bootstrap:administrative`: creates initial PMO/administrative user.
- `npm run db:wipe:keep-admin`: wipes DB while keeping admins.
- `npm run lint`: ESLint.
- `npm test`: Vitest.

Deployment:

- Backend Render service builds with `npm ci --include=dev && npm run build:backend`.
- Backend Render starts with `npm run start:render`.
- Frontend Vercel builds with `npm run build:frontend` and serves `frontend/dist`.

## Reusable Components, Services, Utilities, Hooks, Middleware, API Layers

Frontend reusable pieces:

- Layout: `AppLayout`, `AppSidebar`, `TopBar`, `SidebarNavItem`, `NavLink`, `PageWrapper`.
- Assistant UI: `ChatAssistant`.
- HOD feature component: `components/hod/DprStatusModal.tsx`.
- UI primitives: `components/ui/*` buttons, dialogs, forms, tables, cards, toasts, tooltips, selects, tabs, sheets, sidebar primitives, charts, etc.
- API layer: `frontend/src/lib/api.ts`.
- Auth context/hooks: `frontend/src/lib/auth.tsx`.
- Domain types/status config: `frontend/src/lib/domain.ts`.
- PDF/export utilities: `reports-pdf.ts`, `project-requisition-pdf.ts`, `ra-bill-pdf.ts`, `asset-pdf.ts`, `assistant-report-export.ts`.
- Other utilities/templates: `utils.ts`, `project-plan-template.ts`, `asset-catalog.ts`.
- Hooks: `use-mobile.tsx`, `use-persistent-state.ts`, `use-toast.ts`.

Backend reusable pieces:

- Controllers: one per API resource.
- Services: business logic for auth, users, tasks, reports, projects, project requisitions, financials, assets, assistant, notifications, comments, audit, email, uploads, DPR overview/activity.
- Repositories: Prisma wrappers per model/domain.
- Middleware: `requireAuth`, `requireRole`, `allowSelfOrAdmin`, `validate`, `upload`, `authRateLimiter`, `notFoundHandler`, `errorHandler`.
- Utilities: JWT signing/verifying/hashing, password hashing/comparison, pagination, standard response helpers, custom errors, depreciation, async handler.
- Validators: Zod schemas for all major request payloads.

## Coding Patterns and Conventions

- Layered backend: routes -> middleware/validators -> controllers -> services -> repositories -> Prisma.
- Backend imports use ESM-style `.js` extensions in TypeScript source for NodeNext output.
- Frontend imports use `@/` alias for `frontend/src`.
- Responses are normalized through utility helpers.
- Request validation is centralized in Zod validators.
- Auth state is centralized in `api.ts` and `auth.tsx`.
- React pages commonly use TanStack React Query for data loading.
- Role-specific frontend routes and backend RBAC both enforce access.
- Several frontend API methods include backward-compatible route fallbacks for older backend paths.
- UI follows shadcn/Radix/Tailwind conventions.
- Domain type definitions are duplicated manually on the frontend rather than generated from Prisma/OpenAPI.

## Major Features Implemented

- Public landing page and login.
- JWT authentication with refresh/logout.
- Role-based routing for ADMIN, PMO, HOD, and EMPLOYEE.
- Admin dashboard.
- Employee dashboard.
- Employee profile update.
- User/team management and employee creation.
- Task creation, listing, detail, update, completion, approval, change requests, comments, comment acknowledgements.
- Report templates.
- Employee report submission.
- Admin report review, status, and feedback.
- Project management.
- Project numbering options, preview, and assignment.
- Project requisition forms.
- Financial planning and RA bill workflow.
- All-project financial bill status summary.
- Asset management with asset details, movements, maintenance, depreciation-related data, and stats.
- HOD DPR overview dashboard and status modal.
- Notifications.
- Uploads and static uploaded file serving.
- Assistant/chat feature backed by `GROQ_API`/`GROQ_MODEL`.
- PDF/export generation utilities.
- Bootstrap scripts for admin and administrative users.

## Bugs, Bad Practices, Duplicates, and Potential Improvements

- Security risk: tokens are stored in `localStorage`; httpOnly secure cookies would reduce XSS token theft risk.
- Security risk: `/uploads` is served statically and publicly once a URL is known; access control and storage strategy should be reviewed before production use.
- Security risk: `/send-mail` is public and can send emails with only an email body; consider auth, rate limits, or removal if it is only a test endpoint.
- Deployment risk: `start:render` runs `prisma db push --accept-data-loss`, which can be destructive. Prefer migrations for production.
- Database ambiguity: Prisma schema declares PostgreSQL, but code and files still reference SQLite local behavior/backups.
- Repo hygiene: both `package-lock.json` and `bun.lockb` exist; choose one package manager to avoid drift.
- Config duplication: three Tailwind config files exist, while Vite uses `tailwind.config.cjs`.
- API compatibility fallbacks in the frontend (`/api` fallback and alternate project/RA bill routes) may hide routing/deployment mismatches.
- Type safety gaps: root TypeScript config is relaxed, ESLint disables unused variables, and some backend services/repositories use `any`, especially financial and assistant/DPR areas.
- Large page files: `frontend/src/pages/admin/Financial.tsx` and `frontend/src/pages/admin/Projects.tsx` are very large and likely hard to maintain safely.
- Authorization consistency should be reviewed: some list endpoints are available to any authenticated user and filter in service logic; verify each role's expected visibility.
- Public `.env` exists locally; it is ignored, but secrets should not be copied into docs/logs.
- `run-project.ps1` force-stops listeners on ports, which is convenient but can kill unrelated local processes.
- Test coverage appears thin relative to the amount of business logic, especially auth refresh, RBAC, financial calculations, project numbering, and asset depreciation.
- Existing generated Vite timestamp `.mjs` files are present in `frontend/`; these look like temporary artifacts and should probably not be tracked if they are generated.

## How to Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create or verify `.env` from `.env.example` with at least:

```txt
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGIN=http://localhost:8080,http://localhost:8081
```

3. Prepare the database:

```bash
npx prisma migrate dev
```

4. Create initial users if needed:

```bash
npm run bootstrap:admin -- --email=admin@example.com --password=Admin@123 --name="Admin"
npm run bootstrap:administrative -- --email=pmo@example.com --password=Admin@123 --name="Administrative"
```

5. Start backend and frontend in separate terminals:

```bash
npm run dev
npm run dev:frontend
```

6. Default URLs:

- Backend health: `http://localhost:4000/health`
- Frontend: `http://localhost:8080`

Windows helper alternative:

```powershell
.\run-project.ps1
```

By default the helper starts backend on `4000` and frontend on `8081`.

## Clear Mental Model

This app is a role-based operations dashboard. React owns screens, auth state, API calls, and role redirects. Express owns REST endpoints, request validation, authentication, authorization, and response formatting. Business rules live mostly in backend services. Prisma repositories persist data into PostgreSQL. The main shared contract between frontend and backend is manual TypeScript/domain typing in `frontend/src/lib/domain.ts` plus the REST methods in `frontend/src/lib/api.ts`; there is no generated API client.

High-level flow:

```txt
React page
  -> frontend lib/api method
  -> Express route
  -> auth/RBAC/validation middleware
  -> controller
  -> service
  -> repository
  -> Prisma
  -> PostgreSQL
```

Auth flow:

```txt
Login form
  -> POST /auth/login
  -> access token + refresh token + user stored in localStorage
  -> API requests use Bearer access token
  -> 401 triggers POST /auth/refresh
  -> new access token stored
  -> original request retried
```

Role flow:

```txt
Stored user role
  -> frontend route guard chooses route tree
  -> backend requireRole enforces endpoint permissions
```

## Important Files List

- `package.json`: scripts, dependencies, package manager expectations.
- `.env.example`: environment contract.
- `README.md`: setup/deployment docs.
- `render.yaml`: Render backend deployment.
- `vercel.json`: Vercel frontend deployment.
- `run-project.ps1`: local Windows launch helper.
- `prisma/schema.prisma`: database schema and roles/models.
- `backend/src/server.ts`: backend startup.
- `backend/src/app.ts`: Express app/middleware/router setup.
- `backend/src/config/env.ts`: env validation.
- `backend/src/routes/index.ts`: API route mounting.
- `backend/src/middleware/auth.ts`: JWT auth middleware.
- `backend/src/middleware/rbac.ts`: role/self authorization.
- `backend/src/services/auth.service.ts`: login/refresh/logout.
- `backend/src/prisma/client.ts`: Prisma client and SQLite PRAGMA hook.
- `frontend/src/main.tsx`: React bootstrap.
- `frontend/src/App.tsx`: providers, routes, role guards.
- `frontend/src/lib/api.ts`: frontend API client, token storage, refresh flow.
- `frontend/src/lib/auth.tsx`: auth context.
- `frontend/src/lib/domain.ts`: frontend domain types/status configs.
- `frontend/vite.config.ts`: frontend build/dev config.
- `frontend/tailwind.config.cjs`: active Tailwind config.

## Risk Areas Before Making Changes

- Auth/token handling: localStorage token storage, refresh retry behavior, logout clearing, and backend refresh token revocation.
- RBAC: always check both frontend route guards and backend `requireRole`/`allowSelfOrAdmin` before adding screens or endpoints.
- Financial module: large frontend page and complex backend service/repository logic; changes need focused tests or careful manual verification.
- Project numbering: multiple backward-compatible endpoints and business-specific code generation rules.
- Database migrations: production should not rely on destructive `db push --accept-data-loss`.
- Assets/uploads: file access and persistence model should be reviewed for production storage.
- Assistant service: large service with dynamic actions, `any` usage, and external API dependency.
- DPR/HOD/PMO additions: older docs mention only ADMIN/EMPLOYEE; current code has four roles.
- Frontend/backend contract drift: domain types are manually duplicated rather than generated.
- Very large page components: avoid unrelated refactors while making feature changes.
- Existing local/generated artifacts: avoid modifying logs, timestamp Vite files, local DB backups, or CSV data unless explicitly requested.

