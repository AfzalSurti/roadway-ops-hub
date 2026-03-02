# HighwayOps Backend (Task + Report Management)

Node.js + TypeScript backend for HighwayOps using Express, Prisma ORM, SQLite, JWT auth, role-based access control, uploads, and audit logging.

## Stack

- Node.js + TypeScript
- Express.js
- Prisma ORM + SQLite
- JWT (access + refresh)
- bcrypt
- zod
- multer (local uploads)
- helmet + cors + express-rate-limit
- pino logger with requestId

## Setup

1. Install dependencies

```bash
npm i
```

2. Create env file

```bash
cp .env.example .env
```

3. Run database migration

```bash
npx prisma migrate dev
```

4. (Optional) Run seed command

```bash
npx prisma db seed
```

5. Bootstrap first admin user (required on empty DB)

```bash
npm run bootstrap:admin -- --email=admin@yourcompany.com --password=StrongPass123 --name="Admin User"
```

6. Start API server

```bash
npm run dev
```

Server default URL: `http://localhost:4000`

## Scripts

- `npm run dev` - start backend in watch mode
- `npm run build` - build frontend + backend
- `npm run build:backend` - compile backend
- `npm run start` - run compiled backend
- `npm run prisma:migrate` - prisma migrate dev
- `npm run prisma:seed` - prisma db seed
- `npm run bootstrap:admin -- --email=<email> --password=<password> --name="Admin User"` - create first admin user

## SQLite concurrency settings

On startup the backend executes:

- `PRAGMA journal_mode = WAL;`
- `PRAGMA busy_timeout = 5000;`
- `PRAGMA foreign_keys = ON;`

The default seed script is a no-op and does not insert sample records.

## API Base

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /tasks` (ADMIN)
- `GET /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id` (ADMIN)
- `POST /tasks/:id/comments`
- `GET /tasks/:id/comments`
- `CRUD /templates` (ADMIN)
- `POST /reports` (EMPLOYEE)
- `GET /reports`
- `GET /reports/:id`
- `PATCH /reports/:id/status` (ADMIN)
- `PATCH /reports/:id/feedback` (ADMIN)
- `POST /uploads` (multipart)
- `GET /uploads/:filename` (static)

All responses use:

```json
{
	"success": true,
	"data": {}
}
```

or

```json
{
	"success": false,
	"error": {
		"code": "ERROR_CODE",
		"message": "Readable message",
		"details": {}
	}
}
```
