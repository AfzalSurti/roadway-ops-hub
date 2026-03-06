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
roadway-ops-hub/
├─ frontend/                 # Vite React app (Vercel target)
│  ├─ src/
│  ├─ public/
│  ├─ vite.config.ts
│  └─ ...
├─ backend/                  # Express API (Render target)
│  ├─ src/
│  └─ tsconfig.json
├─ prisma/                   # Prisma schema + migrations
├─ uploads/                  # Local uploads directory
├─ vercel.json               # Vercel build + SPA rewrite config
└─ render.yaml               # Render service blueprint
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

- **Frontend** → **Vercel**
- **Backend** → **Render**

---

## Step-by-Step: Deploy Backend on Render

### 1) Create Render Web Service

1. Push code to GitHub.
2. In Render: **New +** → **Web Service**.
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

In Vercel project settings → Environment Variables:

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
