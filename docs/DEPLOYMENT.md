# Deployment — HighwayOps Hub

Frontend on **Vercel**, backend on **Render**, database on **Neon PostgreSQL**. The API is also configured to sit behind a single nginx reverse-proxy hop (`app.set("trust proxy", 1)` in `backend/src/app.ts`).

> **Note on migrations:** `prisma/migrations/migration_lock.toml` still records `sqlite` from the project's early phase, while the schema targets PostgreSQL. `prisma migrate deploy` therefore fails against Postgres (P3019) until the migration history is re-baselined. Until then use `npx prisma db push` (as `render.yaml` does). Avoid `--accept-data-loss` on a database with real data.

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
     npm install && npm run build:backend && npx prisma db push
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
