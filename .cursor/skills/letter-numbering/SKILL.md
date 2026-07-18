---
name: letter-numbering
description: >-
  Implement or change DPR Admin Letter Numbering (letter projects, inward/outward
  numbering, project sync). Use when the user mentions letter numbering, letter
  database, letter head, or syncing letter projects with the Project section.
---

# Letter Numbering Skill

Follow `contributors/cursor-agents/letter-numbering/AGENT.md` as the source of truth for business rules and file paths.

## Defaults

- Keep Admin + PMO access.
- Preserve Outward format: `{projectNumber}/{projectCode}/{serial}/{outwardSeq}`.
- Always offer sync into the main Project section for new letter projects.
- Put numbering helpers in `backend/src/utils/letter-numbering.ts`.
