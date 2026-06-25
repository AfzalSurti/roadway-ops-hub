# OpsForge Showcase Site

A **standalone portfolio / marketing website** for LinkedIn and freelance outreach. It showcases the capabilities of a full-stack enterprise operations platform **without any client name, dates, or confidential data**.

## What it includes

- Hero with animated product mockup
- **6 switchable UI screenshots** (dashboard, projects, financial, assets, expenses, HOD view) — screenshot-ready for LinkedIn
- 9 module cards (DPR, projects, finance, assets, expenses, HOD, AI, auth, exports)
- 4 user role breakdowns (Admin, PMO, HOD, Employee)
- Technical capabilities & stack sections
- Contact CTA (update LinkedIn URL in `src/components/CTA.tsx`)

## Run locally

```bash
cd showcase-site
npm install
npm run dev
```

Opens at **http://localhost:3099**

## Build for deploy

```bash
npm run build
npm run preview
```

Deploy `showcase-site/dist` to Vercel, Netlify, or GitHub Pages.

## LinkedIn tips

1. Open the site → go to **Product Screens** section
2. Click each tab (Dashboard, Projects, etc.)
3. Take screenshots — they look like real app UI in browser frames
4. Post with caption: *"Built a full-stack ops platform for engineering consultancies — DPR, finance, assets, expenses, executive dashboards. Need something similar? Let's connect."*

## Customize

| File | What to change |
|------|----------------|
| `src/components/CTA.tsx` | Your LinkedIn profile URL |
| `src/components/Navbar.tsx` | Brand name "OpsForge" if desired |
| `index.html` | Page title & meta description |
