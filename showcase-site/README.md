# OpsForge Showcase Site

Portfolio / marketing website for LinkedIn and freelance outreach. No client names or dates.

## Features

- **Problem → Solution** section (Excel pain points vs platform)
- **4 role-based UI mocks** (DPR Admin, PMO, HOD, Employee) — screenshot-ready
- **Contact form** → emails you via Resend when someone submits
- Module cards, tech stack, capabilities

## Setup

```bash
cd showcase-site
npm install
cp .env.example .env
```

Edit `.env`:

```env
RESEND_API_KEY=re_your_key_here
CONTACT_EMAIL_TO=your@gmail.com
CONTACT_EMAIL_FROM=OpsForge Portfolio <onboarding@resend.dev>
CONTACT_SERVER_PORT=3098
```

> **Resend note:** Free tier sends from `onboarding@resend.dev`. Replies go to the visitor's email via `replyTo`. Verify your domain in Resend to use a custom `from` address.

## Run locally

```bash
npm run dev
```

- Website: **http://localhost:3099**
- Contact API: **http://localhost:3098** (proxied via Vite)

## Deploy to Vercel

1. Create a new Vercel project with **Root Directory** = `showcase-site`
2. Add environment variables in Vercel dashboard:
   - `RESEND_API_KEY`
   - `CONTACT_EMAIL_TO`
   - `CONTACT_EMAIL_FROM` (optional)
3. Deploy — the `/api/contact` serverless function handles form submissions

## LinkedIn workflow

1. Open **The Problem** section — screenshot the before/after comparison
2. Open **Product Screens** — click each of the 4 roles and screenshot
3. Share your live Vercel URL in the post

## Security

- Never commit `.env` (already in `.gitignore`)
- If your API key was shared publicly, rotate it in the [Resend dashboard](https://resend.com/api-keys)
