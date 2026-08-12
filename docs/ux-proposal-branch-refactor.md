PSG Rebrand — Branch-First UX & Workflow Refactor Proposal

Overview
--------
This document outlines a minimally invasive, iterative plan to refactor the application UX toward an operational, branch-first experience while preserving existing data and behaviour.

Goals
-----
- Surface the current state (status, stage, task, owner, due date) prominently on the Branch page.
- Provide a lightweight Quick Update flow that is mobile-first and non-destructive.
- Introduce a first-class Blocker concept mapped to activity records (no immediate schema migrations).
- Improve dashboard discovery: Attention Required + Upcoming Work + Recent Activity.
- Make incremental changes with small commits and easy rollbacks.

Phase 1 (Completed)
--------------------
- Full code audit (performed).
- Backup copy created at `backup12aug`.
- Small runtime hardening patches applied and pushed: branch/project mapping, Vite env loading, BranchesPage TDZ fix.

Phase 2 — UX Proposal (this document)
------------------------------------
Deliverables:
- Wireframe / component mapping for Branch page, Dashboard, Quick Update modal variants.
- File-level plan listing the small set of files to change.

High-level Branch Page layout (mobile-first)
--------------------------------------------
HEADER
- Branch Name
- Project (link)
- Location
- Status pill (Blocked / In progress / Completed)

CURRENT STATE (large card)
- Current stage (visual progress tracker)
- Current task (task title)
- Status (Scheduled / In progress / Blocked / Completed)
- Owner
- Due date
- Quick action buttons: [Add Update] [Report Blocker] [Mark Complete]

LATEST UPDATE (small card)
- Message excerpt
- Author, timestamp
- Attachments preview

NEXT ACTION
- Short text of next action, owner, date

REQUIREMENTS / BLOCKERS
- Prominent block indicator with reason, owner, expected resolution date

ACTIVITY (historical)
- Chronological list (collapsed by default)

DOCUMENTS
- Attachments and quick download links (lazy-loaded thumbnails)

Component list (new / modified)
- `CurrentTaskCard` (new): shows current state + quick actions
- `QuickUpdate` (new): modal shared by update types (Scheduled/Blocked/Completed/General)
- `BlockerBanner` (new): visual sticky indicator when branch blocked
- `BranchDetailPage` (modified): reorder, render new components, keep existing timeline lower
- `BranchesPage` (modified): ensure project counts and filters work with open-projects map (already hardened)
- `DashboardPage` (modified): add Attention Required + Upcoming sections that reuse existing services
- `portalService` (modified, small): treat structured update entries as `CommentItem` enriched with `type` and optional `nextAction` — non-destructive

Data model and storage strategy (conservative)
----------------------------------------------
- Avoid DB schema changes initially.
- Store structured updates by extending `CommentItem` semantics:
  - Reuse `comments` / `activity` arrays on Project as the single source of truth for updates.
  - When creating a "blocker" or structured update, insert a comment with a `type` field (e.g. `"blocker"`, `"scheduled"`, `"completed"`) and a small JSON payload in `message` or `relatedChanges` (backwards-compatible). Example comment: `{ kind: 'comment', date: '2026-08-12', author: 'Beverley', message: 'Roof access required', type: 'blocker', blockerOwner: 'Branch', expectedResolution: '2026-08-18' }`.
- For short-term UI-only blocker flag (fast): keep a derived `blocker` state (computed from latest activity of type `blocker`) rather than adding a new DB column.
- Later phase: propose a migration to add a `blockers` table/column for reporting.

Implementation plan (Phase 4: Branch UX prototype — non-destructive)
------------------------------------------------------------------
1. Create `src/components/CurrentTaskCard.tsx` — present current state and quick buttons.
2. Create `src/components/QuickUpdate/QuickUpdate.tsx` + small style file — modal with variant forms.
3. Add helper `createStructuredComment(projectId, branchId, author, type, payload)` in `portalService` to persist a typed update via existing comments API.
4. Modify `src/pages/BranchDetailPage.tsx` to render `CurrentTaskCard` at the top, `LatestUpdate` and `QuickUpdate` modal opener; keep existing activity/timeline below.
5. Add lazy-loading/thumbnails for attachments (already available: will only call signed-URL when visible).
6. Add acceptance tests / manual checklist (branch user, update, blocker flows).

Files likely to be edited
------------------------
- `src/pages/BranchDetailPage.tsx` (reorder + render new components)
- `src/components/CurrentTaskCard.tsx` (new)
- `src/components/QuickUpdate/QuickUpdate.tsx` (new)
- `src/services/portalService.ts` (helper to create structured comments)
- `src/types/domain.ts` (optional: annotate new `CommentItem.type` — purely TypeScript)
- `src/pages/DashboardPage.tsx` (later) — Attention Required widgets

Testing and verification
------------------------
- Unit / integration: createStructuredComment writes to comments via existing REST flow and `getProjects()` shows the new entry.
- Manual acceptance: Branch user test (open branch, add update under 20s), Blocker test, Head Office filter test on Dashboard.

Phase 3 (Data model review)
---------------------------
- Compare `CommentItem` and `ActivityItem` types in `src/types/domain.ts` against desired structured update fields; identify minimal type extension and how it maps to DB `comments` column (likely JSONB in Supabase).

Risks and mitigations
---------------------
- Risk: inconsistent comment shapes across projects. Mitigation: use server-side function or client helper to canonicalize the structure before inserting.
- Risk: large attachments slow page load. Mitigation: lazy-generate signed URLs and fetch thumbnails only when visible.

Next steps (what I will do now)
-------------------------------
With your approval I will:
1. Implement Phase 4 prototype (Quick Update + Current Task card) on a new feature branch, using only the existing `comments`/`activity` infrastructure to store structured updates. Changes will be small, isolated, and reversible.
2. Run `npm run build` and test the flow locally on desktop and mobile breakpoints.

If you prefer I can implement a smaller initial step first (Quick Update modal only) and demo it.

Acceptance
----------
- I will create the feature branch, implement the prototype, and open a short review here with links to modified files. All changes will be committed with clear messages and pushed to `origin`.

---

Document created: docs/ux-proposal-branch-refactor.md

Please confirm if you want me to proceed with the Phase 4 prototype (Quick Update + Current Task card) now, or if you prefer to adjust the proposal first.
