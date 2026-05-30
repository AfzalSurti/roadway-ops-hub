# Roadway Ops Hub - Project Analysis

Date: 2026-05-30

## Project Overview
- Full-stack TypeScript application: React + Vite frontend and Express + Prisma backend.
- Role-based app (ADMIN / EMPLOYEE) for managing tasks, reports, projects, financials, uploads, notifications, and an assistant feature.

## Folder-by-folder Explanation
- `/` — Root: `package.json` (scripts, deps), `render.yaml`, `vercel.json`, `README.md`.
- `/backend`
  - `src/app.ts` — Express app configuration (CORS, helmet, logging, static uploads) and router mount.
  - `src/server.ts` — Bootstrap: Prisma connect, database configure, start server.
  - `src/config` — `env.ts` (Zod-validated env vars), `logger.ts`.
  - `src/routes` — Resource routers (`/auth`, `/tasks`, `/reports`, `/templates`, `/projects`, `/uploads`, `/assistant`, etc.).
  - `src/controllers` — Controller layer for each resource.
  - `src/services` — Business logic (auth, task, report, email, assistant, etc.).
  - `src/repositories` — Prisma-based DB access wrappers.
  - `src/middleware` — `requireAuth`, error handler, rate limiter, RBAC, upload handling.
  - `src/prisma/client.ts` — Prisma client and SQLite PRAGMA setup (dev special-case).

- `/frontend`
  - `src/main.tsx` — React entry and root render.
  - `src/App.tsx` — Router, route guards (`AdminRoute`, `EmployeeRoute`), React Query provider.
  - `src/lib/api.ts` — Central API client, token handling, refresh flow, localStorage session.
  - `src/lib/auth.tsx` — `AuthProvider` and `useAuth` hook.
  - `src/components` — Reusable UI components and `ui/*` primitives.
  - `src/pages` — Page views for Admin and Employee.
  - Vite + Tailwind config files.

- `/prisma` — `schema.prisma` (Postgres provider declared); migrations folder with multiple migrations.

## Tech Stack Summary
- Frontend: React 18 + TypeScript, Vite, React Router, @tanstack/react-query, Radix UI, Tailwind CSS.
- Backend: Node (ESM) + TypeScript, Express, Prisma ORM.
- Database: PostgreSQL (production); dev often supports SQLite when `DATABASE_URL` starts with `file:`.
- Auth: JWT short-lived access tokens + long-lived refresh tokens; refresh tokens stored hashed in DB.
- Email: Resend (preferred) with nodemailer/SMTP fallback.
- Package manager: npm.

## Important Files
- `package.json` — root scripts and dependencies.
- `backend/src/server.ts` — server bootstrap.
- `backend/src/app.ts` — express app and route mounting.
- `backend/src/config/env.ts` — environment schema and validation.
- `backend/src/services/auth.service.ts` — login/refresh/logout logic.
- `backend/src/utils/jwt.ts` — sign/verify/hash tokens.
- `backend/src/prisma/client.ts` — Prisma client configuration.
- `prisma/schema.prisma` — database schema.
- `frontend/src/main.tsx` and `frontend/src/App.tsx` — frontend entry and router.
- `frontend/src/lib/api.ts` — API client with refresh behavior.
- `frontend/src/lib/auth.tsx` — auth provider and hooks.

## Main Entry Points
- Backend: `backend/src/server.ts` (starts server, connects Prisma).
- Frontend: `frontend/src/main.tsx` (mounts React app).

## Architecture & Data Flow
1. Frontend UI calls `api` client (`frontend/src/lib/api.ts`) to hit REST endpoints on backend.
2. `api` attaches access token from `localStorage`. On 401 it attempts to refresh via `/auth/refresh` using refresh token (also in `localStorage`), updates access token, and retries the original request.
3. Backend Express app (`backend/src/app.ts`) routes requests to resource routers; protected routes use `requireAuth` which verifies access JWT and sets `req.user`.
4. Controllers delegate to `services/*` which contain business logic and call `repositories/*` to interact with the DB via Prisma.
5. Refresh tokens are stored hashed (sha256) in `RefreshToken` model; refresh flow validates hashed token and expiry.

## Reusable Components, Services & Utilities
- Frontend: `components/*` (UI primitives), `lib/api.ts` (API client), `lib/auth.tsx` (AuthProvider), React Query usage patterns.
- Backend: `services/*` (business logic), `repositories/*` (DB access), `utils/*` (jwt, password, response), `middleware/*`.

## Coding Patterns & Conventions
- Layered architecture: controllers -> services -> repositories.
- ESM module imports with `.js` extensions in compiled import paths.
- Zod used for env validation and (likely) request validation.
- Centralized response format (`sendSuccess` / `sendError`).
- Access and refresh JWTs with separate secrets and durations; refresh tokens hashed before DB storage.

## Major Features Implemented
- Authentication (login, refresh, logout, onboarding emails).
- Role-based UI & routing (ADMIN vs EMPLOYEE).
- Task management (create/list/update/complete/approve/comment).
- Reporting system (templates, submit, review, feedback).
- Projects & requisition forms with project numbering utilities.
- Financial models (plans, bills, RA bills, carry forwards).
- File uploads and attachments.
- Notifications and audit logs.
- Assistant/AI integration.

## Environment Variables (backend)
- Required/important: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `CORS_ORIGIN`.
- Optional/conditional: `GMAIL`, `APP_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `GROQ_API`, `GROQ_MODEL`.
- Frontend: `VITE_API_URL` for API base URL.

## Build & Deployment
- Dev: `npm run dev` (backend watcher via `tsx`), `npm run dev:frontend` (vite).
- Build: `npm run build` (frontend + backend compile), `npm start` runs `backend/dist/server.js`.
- Prisma migrations live in `/prisma/migrations`.
- `vercel.json` and `render.yaml` present for deployment targets.

## Bugs, Bad Practices & Potential Improvements
- Storing tokens in `localStorage`: XSS risk — consider httpOnly cookies.
- Frontend refresh strategy treats transient refresh failures leniently; may mask expired sessions.
- Dual DB driver handling (Postgres vs SQLite) requires clear dev docs; migrations behave differently.
- Frontend retries with `/api` prefix on 404 — may hide misconfigured base paths.
- Static `uploads/` served publicly — validate and restrict access as needed.
- Missing `.env.example` and limited integration tests for auth/refresh flows.

## Risk Areas (also saved to repo memory)
- Token storage & refresh edge cases, DB driver ambiguity, email provider fallbacks, public uploads, and secret management. See `/memories/repo/roadway-ops-hub-risk-areas.md` for the brief list.

## How to Run Locally (minimal)
1. Create `.env` with required keys (at least `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
2. Install dependencies and start dev servers:

```bash
npm install

# backend dev (watch)
npm run dev

# frontend dev
npm run dev:frontend
```

3. For Postgres, run migrations: `npx prisma migrate dev` (or use `start:render` which calls `prisma db push`).

## Mental Model — How Everything Connects
- UI interacts with `api` client → Express endpoints → controllers → services → repositories → Prisma → Database.
- Auth: frontend stores access & refresh tokens, access token used for requests, refresh token used to obtain new access token. Backend validates tokens and stores hashed refresh tokens.
- Side effects: Email (Resend/SMTP), file storage in `uploads/`, assistant uses external model APIs.

## Next Suggested Actions
- Add `.env.example` and developer README for DB setup.
- Consider moving tokens to httpOnly cookies or add thorough XSS protections if continuing with `localStorage` approach.
- Add integration tests for auth and refresh flows.

---
Analysis saved to project root as `PROJECT_ANALYSIS.md` and risks also saved to `/memories/repo/roadway-ops-hub-risk-areas.md`.
