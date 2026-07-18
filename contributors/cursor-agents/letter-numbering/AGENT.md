---
name: letter-numbering-agent
description: >-
  Cursor agent for the DPR Admin Letter Numbering module. Use when adding
  features, fixing numbering logic, syncing letter projects with the main
  Project section, or changing letter grid UX (autocomplete, back-date inserts).
---

# Letter Numbering Agent

## Scope

Work only on the Letter Numbering module and its sync with Projects:

| Area | Paths |
|------|--------|
| Schema | `prisma/schema.prisma` (`LetterProject`, `LetterEntry`, `LetterCategory`) |
| Migration | `prisma/migrations/20260718100000_add_letter_numbering/` |
| Backend | `backend/src/**/letter-numbering.*`, `backend/src/utils/letter-numbering.ts` |
| Frontend | `frontend/src/pages/admin/LetterNumbering.tsx`, API/domain types |
| Routes | Admin `/admin/letter-numbering`, PMO `/administrative/letter-numbering` |

## Product rules (from DPR Admin mockups)

1. **Module sections**
   - New Project Add
   - All Project List
   - Letter Data Base (project filter + letter grid)

2. **Letter project fields**
   - Project Number (e.g. `376`)
   - Project Code (e.g. `GSIR2305R`)
   - Short Name, Full Name
   - Project Coordinator, Project Engineer

3. **Sync with Project section**
   - Letter projects can link to main `Project` via `linkedProjectId`.
   - Creating a letter project may set `syncToMainProject: true`.
   - Import from main projects: `POST /letter-numbering/projects/import`.
   - Push letter-only projects into Projects: `POST /letter-numbering/projects/:id/sync-to-main`.
   - Never orphan UI from API — keep sync buttons wired.

4. **Letter number auto-generation**
   - **Inward / Other** → letter number = Sr. No (`01`, `02`, `3a`…).
   - **Outward** → `{projectNumber}/{projectCode}/{serial}/{outwardSeq}`  
     Example: `376/GSIR2305R/01/01`.
   - Outward sequence increments only among Outward rows (`01`, `02`…).
   - Back-date insert (`+` under a row): serial becomes `3a`, `3b`…; outward may become `02a`.

5. **Autocomplete (four columns)**
   - Sent By, Sent To, Subject, CC To suggest prior values from the same column.
   - Use `GET /letter-numbering/suggestions?field=...`.

6. **Access**
   - Roles: `ADMIN`, `PMO` only (middleware on `/letter-numbering`).

## How to work

1. Prefer small commits; keep numbering logic in `backend/src/utils/letter-numbering.ts`.
2. Regenerate Prisma client after schema changes.
3. Match existing UI patterns (`PageWrapper`, `glass-panel`, Admin sidebar).
4. Do not break Infra or Financial modules.
5. After Neon deploy, ensure migration SQL (or `prisma db push`) has been applied.

## Quick test checklist

- [ ] Add letter project with “Also add to Project section”
- [ ] Import existing Project into Letter Data Base
- [ ] Add Outward / Inward / Other and verify letter numbers
- [ ] Insert back-dated row with `+` → serial like `3a`
- [ ] Autocomplete appears when typing in Sent By
- [ ] “Add to Projects” works for letter-only projects
