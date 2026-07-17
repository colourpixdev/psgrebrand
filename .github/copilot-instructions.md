# Workspace Instructions

This workspace contains a production-oriented scaffold for the PSG Signage Rollout Portal.

## Goals

- Keep the portal secure, role-aware, and maintainable.
- Prefer small reusable components and typed domain models.
- Preserve the rollout workflow, activity log, uploads, notifications, search, and reporting surfaces.
- Use Supabase-ready abstractions for auth, database, storage, and realtime updates.

## Implementation Notes

- Use the existing mock data layer as the default local experience.
- Keep the dashboard, projects, reports, and login flows responsive.
- Avoid introducing extra dependencies unless they support the requested stack.
- Keep code changes focused and validate with `npm run build` or `npm run check` after edits.
