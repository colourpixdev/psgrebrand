# Workspace Instructions

This workspace contains a production-oriented scaffold for PSG Rebrand, an Enterprise Rollout Management Platform.

## Goals

- Keep the platform secure, role-aware, and maintainable.
- Prefer small reusable components and typed domain models.
- Preserve the rollout workflow, Project Journal, uploads, notifications, search, and reporting surfaces.
- Use Supabase-ready abstractions for auth, database, storage, and realtime updates.

## Implementation Notes

- Use the existing mock data layer as the default local experience.
- Keep the dashboard, projects, reports, and login flows responsive.
- Avoid introducing extra dependencies unless they support the requested stack.
- Keep code changes focused and validate with `npm run build` or `npm run check` after edits.

## Credit Conservation Mode

- Deliberately minimize Copilot credit usage in this workspace.
- For simple SQL, Supabase admin, Git, or configuration questions, answer directly without reading the repo or running tools unless the user explicitly asks you to execute the change.
- Prefer one targeted file read or search before editing. Avoid broad exploration, repeated grep calls, or opening many files unless the task genuinely requires it.
- Do not run `npm run build` after every small edit. Prefer `npm run check` for TypeScript-only validation, and run `npm run build` only before publishing or when asset generation/runtime bundling matters.
- Do not publish automatically after every change. Batch small changes together and publish only when the user explicitly asks to publish.
- Avoid repeated Supabase live checks, Edge Function tests, or database queries unless they can change the outcome of the task.
- Keep progress updates and final answers concise. Do not restate long plans or previous context unless the user asks for detail.
- Reuse known project facts from the current conversation and repo instructions instead of rediscovering them with tools.
- When validation is needed, run the cheapest meaningful validation first. Stop after one passing focused validation unless a broader check is required.
- Before doing expensive work, briefly state the intended check or edit and choose the smallest path that can satisfy the request.
