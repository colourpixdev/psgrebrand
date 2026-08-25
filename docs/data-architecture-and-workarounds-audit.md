# Data Architecture and Workarounds Audit

Date: 2026-08-25

This document describes the current implementation as it exists in the repository. It is an audit, not a claim that the architecture is clean or fully migrated.

## Executive Findings

### Critical: Two sources of truth coexist

The app stores operational data in both:

- Legacy `projects` rows, including JSON fields such as `tasks`, `files`, `comments`, and `activity`.
- Relational tables: `rebrand_workspaces`, `project_tasks`, `project_files`, `file_versions`, and related tables.

The app reads the legacy project row first, then conditionally replaces parts of it with relational data. This creates split-brain behavior when the two records disagree.

Example observed in production:

- Legacy project task: `Pending`, `Unassigned`.
- Relational task with the same stage: `waiting` in the database, mapped to `Started` in the UI, assigned to Judith.

The project detail page can therefore show different status and assignee values in different sections.

Owner: [src/services/portalService.ts](../src/services/portalService.ts), `mapProjectRow`, `getProjectById`, `getProjects`.

### Critical: RLS changes are not automatically deployed

GitHub Pages deploys the frontend only. SQL files under `supabase/migrations` are not executed by the GitHub workflow.

Relevant manual migrations:

- [20260825000400_allow_assigned_users_file_reads.sql](../supabase/migrations/20260825000400_allow_assigned_users_file_reads.sql)
- [20260825000600_remove_recursive_assignee_policy.sql](../supabase/migrations/20260825000600_remove_recursive_assignee_policy.sql)
- [20260825000700_read_rebrand_task_assignees.sql](../supabase/migrations/20260825000700_read_rebrand_task_assignees.sql)

A migration can exist in GitHub while the live database still has the previous policy set.

### High: Role normalization collapses roles

[src/types/domain.ts](../src/types/domain.ts), `normalizeRole`, maps `psg_head_office`, `psg_branch_manager`, and `sign_company` to `psg_user`. That means code using the normalized role cannot distinguish those roles reliably.

This is a direct source of permission and visibility errors. Role normalization must preserve every supported role unless there is an explicit, documented capability grouping.

### High: Task statuses are lossy

Database statuses are:

- `not_started`
- `in_progress`
- `complete`
- `waiting`
- `blocked`

[src/services/portalService.ts](../src/services/portalService.ts), `convertRelationalTaskToTaskItem`, maps:

- `not_started` -> `pending`
- `in_progress` -> `busy`
- `complete` -> `done`
- `waiting` -> `open`
- `blocked` -> `open`

The UI cannot distinguish waiting from blocked after this conversion. The reverse mapping also maps UI `open` to database `waiting`, so a status round trip changes meaning.

### High: Follow state has two stores and asynchronous races

[src/services/projectFollowService.ts](../src/services/projectFollowService.ts) uses:

- Browser `localStorage` for immediate UI state.
- Supabase `user_followed_items` for cross-browser state.

The service also supports legacy project IDs and branch IDs in the same `item_id` column. This is a compatibility workaround, not a normalized model.

Current protections include:

- Local change revision protection during sync.
- Remote state preferred after the initial migration.
- Local IDs used for one-time migration when the remote list is empty.

Residual risk: stale legacy IDs can remain in the remote table, and failed remote reads leave the browser showing its local copy.

## Current Data Flow

### Project read

1. `getProjectById` reads one row from `projects`.
2. `mapProjectRow` converts the legacy row into the domain `Project` object.
3. If `branch_id` exists, the service looks up the primary relational workspace.
4. Relational tasks are fetched from `project_tasks`.
5. Relational files are fetched from `project_files` and current `file_versions`.
6. Relational tasks/files replace legacy arrays only when non-empty; otherwise the legacy arrays remain.
7. The UI consumes the resulting mixed object.

### Project list read

`getProjects` reads all visible `projects`, looks up workspaces, fetches relational tasks, groups them by `branch_id`, then assigns those tasks to every project with that branch ID. This assumes one operational project per branch. If a branch has multiple projects, tasks can be attached to the wrong project.

Owner: [src/services/portalService.ts](../src/services/portalService.ts), `getProjects`.

### Task update

`updateProjectTask`:

1. Reloads the project.
2. Finds the task by `input.taskId`.
3. Builds a new legacy JSON task array.
4. Resolves the assignee email to a profile ID.
5. Updates the relational `project_tasks` row.
6. Updates the legacy `projects.tasks` JSON field.
7. Returns an in-memory project object.

The two writes are not one database transaction. A failure between them can leave legacy and relational task data different.

### Assignee read

The relational task has `responsible_person_id`, but direct nested profile reads can be blocked by RLS. The current workaround is `get_rebrand_task_assignees`, a `security definer` RPC in [20260825000700_read_rebrand_task_assignees.sql](../supabase/migrations/20260825000700_read_rebrand_task_assignees.sql).

The RPC returns assignee name, email, and profile title only for workspaces the signed-in viewer can access. The frontend hydrates tasks with those results.

A prior attempt to solve this with a `profiles` SELECT policy caused infinite RLS recursion because that policy read `project_tasks`, while the workspace authorization function read `profiles`. That policy was removed by [20260825000600_remove_recursive_assignee_policy.sql](../supabase/migrations/20260825000600_remove_recursive_assignee_policy.sql).

### File read

Relational files are attached through `project_files.task_id`. The UI filters stage files by the selected task ID. Project-level files with a null `task_id` are currently included in the current-stage panel as a compatibility workaround.

Files can be invisible if:

- The PSG file-read RLS migration has not been run.
- The workspace lookup fails.
- The file belongs to a different workspace.
- A relational read returns empty and the legacy project has no copy.

### Branch allocation

The dashboard's allocation section now checks:

- Project coordinator email/name (`managerEmail` or `manager`).
- Any task assignee email/name in `assigneeEmail`, `assigneeName`, or `assignees`.

Owner: [src/pages/DashboardPage.tsx](../src/pages/DashboardPage.tsx), `myBranches`.

This is UI-side matching, not a database allocation query. It depends on the task and assignee data being hydrated correctly first.

### Followed branches

Branches are represented using branch IDs, while older follow records may contain project IDs. `ProjectFollowButton` receives a primary ID and optional legacy project IDs and checks all of them.

PSG users are now blocked from the follow UI by role. Non-PSG signed-in users sync through Supabase. The dashboard still uses the same service for follow state and separately displays allocated branches.

## Permission Rules Currently Implemented

- PSG roles can view assigned projects according to `filterProjectsForUser` and workspace access.
- PSG users can download files but cannot upload, rename, or delete them.
- PSG users cannot add task comments.
- PSG users cannot follow branches.
- The assignee RPC is intended to expose only assignee display fields, not unrestricted profile access.

The implementation currently has both role policy checks and ad hoc checks such as `role.startsWith('psg_')`. These can diverge.

## Known Workarounds

1. Keep legacy JSON arrays as fallback when relational queries fail or return empty.
2. Prefer populated/latest task records when duplicate stage records exist.
3. Use a `security definer` RPC to avoid recursive profile RLS.
4. Store follow state locally for immediate interaction and remotely for cross-browser persistence.
5. Accept both branch IDs and legacy project IDs for follow compatibility.
6. Show unassigned project files in the current stage panel.
7. Match allocation by both names and emails because older records do not consistently use one identity field.
8. Preserve scalar and array assignee fields because older task records use scalar fields.

These workarounds reduce visible breakage but do not remove the underlying duplication.

## Recommended Target Architecture

1. Make relational tables the only source of truth for workspaces, stages/tasks, assignees, and files.
2. Keep legacy JSON fields read-only during a defined migration window, then remove them from operational reads.
3. Associate a project to exactly one workspace by a foreign key, not by `branch_id` grouping.
4. Give every task a stable stage/task ID and render summaries by that ID, never by fuzzy stage-name matching.
5. Use one status enum or an explicit lossless mapping. Do not map `waiting` and `blocked` both to `open`.
6. Store follows as `user_id + branch_id` in a branch-specific table. Migrate project-ID records once and delete the compatibility path.
7. Define capabilities separately from roles. Preserve the full role identity in `normalizeRole`.
8. Keep assignee display reads behind one tested database function or a safe view.
9. Add end-to-end tests for: save assignee -> reload; save stage status -> reload; PSG file read; followed branch across two sessions; and project/branch task isolation.
10. Add a real migration runner to deployment or make the deployment checklist enforce SQL application and verification.

## Minimum Audit Tests

- Query one known project as admin and PSG user; compare project ID, workspace ID, task IDs, status, assignee profile ID, and file IDs.
- Update a stage assignee, reload the project from a fresh browser session, and compare the task ID and assignee fields.
- Update stage status and verify the project status is unchanged.
- Follow/unfollow a branch in two browser sessions and verify both read the same remote `item_id` set.
- Run the recursive-policy smoke test after every RLS change.
