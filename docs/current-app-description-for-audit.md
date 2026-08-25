# PSG Rebrand: Current Application Description

## Purpose

PSG Rebrand is a private project-management workspace for tracking branch rebrand and signage rollout work. It gives internal staff, PSG users, service partners, and suppliers a shared view of projects, stages, tasks, files, updates, questions, and reporting.

The current configured workspace is the PSG Branch Rebrand programme. The code is intended to support additional client workspaces and project templates later, but the active operational data is PSG-focused.

The authenticated app is not the public marketing website. The separate `website/` application handles enquiries, demo requests, workspace requests, and new business intake. The authenticated app handles active delivery work after users receive access.

## What Users Can Do

Depending on role and permissions, users can:

- Sign in through Supabase Auth or use local preview authentication.
- View a dashboard with project totals, progress summaries, followed branches, and attention items.
- Browse branches and open their project workspaces.
- View project details, current stage, status, dates, tasks, assignees, files, comments, questions, and history.
- Add, edit, reorder, complete, reopen, assign, and remove project tasks where permitted.
- Upload, preview, download, rename, and delete project files where permitted.
- Add task updates and project comments.
- Ask questions and allow authorised workspace users to answer them.
- Search projects and use map, report, profile, settings, support, and user-management screens.
- Follow projects or branches for dashboard visibility.
- Use voice-update transcription through the configured Supabase Edge Function when enabled.

The UI is role-aware. A visible control is not by itself the security boundary; Supabase policies and service-side checks are responsible for enforcing access.

## Main Data Model

The application currently operates during a staged migration from legacy JSON data to relational data.

### Legacy project record

The `projects` table still contains project-level operational fields, including:

- `tasks` JSON
- `files` JSON
- `comments` JSON
- `activity` JSON
- project status, current stage, dates, branch information, and presentation fields

Legacy fields remain for compatibility and are still written by some service methods during the migration.

### Relational workspace data

The newer relational model contains:

- `rebrand_workspaces`
- `project_tasks`
- `project_files`
- `file_versions`
- `project_activity`
- supporting workflow, file-category, access, request, approval, and notification tables

Relational tasks are identified by `project_tasks.id`. Relational files are identified by `project_files.id`, with versions in `file_versions`.

Phase 2 adds `projects.rebrand_workspace_id`, a UUID foreign key to `rebrand_workspaces.id`. This is the explicit project-to-workspace relationship used by the updated relational read paths. The older text `projects.workspace_id` field remains for compatibility.

## Read Flow

The intended read path is:

```text
React page
  -> portalService
  -> projects row
  -> explicit projects.rebrand_workspace_id
  -> rebrand_workspaces
  -> project_tasks / project_files / file_versions
  -> domain Project
  -> UI
```

`src/services/portalService.ts` is the main portal read adapter.

- `getProjects()` reads project rows, collects explicit workspace UUIDs, fetches relational tasks by workspace UUID, and assigns each result back to its project by that explicit UUID.
- `getProjectById()` reads one project and fetches relational tasks and files only through that project's explicit workspace UUID.
- `hydrateProjectFiles()` uses the already-resolved project workspace ID. It does not discover a workspace by branch ID.
- `applyRelationalProjectData()` centralises whether relational data replaces legacy data.
- A successful relational query returning zero rows is authoritative and produces an empty task/file collection. Legacy data is used only when the relational query is unavailable or fails.
- A project without an explicit relational workspace link is not allowed to borrow another project's relational tasks or files. It remains on its legacy compatibility data until linked.

The Phase 2 migration must be applied to the Supabase database before live projects receive the new explicit links. The repository contains the migration, but GitHub Pages does not run Supabase migrations automatically.

## Task Identity

Task identity is UUID-based throughout the active project-detail flow.

- Relational task conversion preserves `project_tasks.id`.
- Summary selection stores the selected task UUID.
- Stage checklist cards are keyed by task UUID and operate on the task object directly.
- Task status, assignment, comments, files, deletion, and reordering use `task.id`.
- The service verifies both task ID and workspace ID when updating relational tasks.
- Stage names and display labels are not used to choose a task in the active project-detail path.

The legacy compatibility service still contains creation paths for legacy task records that can generate local IDs. Those IDs are not used to replace a relational database task ID when a relational row exists.

## Status Model

Relational task statuses are:

```text
not_started
in_progress
complete
waiting
blocked
```

The domain compatibility names are:

```text
pending
busy
done
waiting
blocked
```

The shared translation helpers in `src/utils/taskStatus.ts` preserve the five relational states:

| Database | Domain |
|---|---|
| `not_started` | `pending` |
| `in_progress` | `busy` |
| `complete` | `done` |
| `waiting` | `waiting` |
| `blocked` | `blocked` |

`waiting` and `blocked` are distinct in the domain and UI. They must not be collapsed into `open`.

The older `open` domain value remains for legacy compatibility. It maps to the waiting-style relational state when sent through the current compatibility writer.

## Assignees

Relational task assignment is stored through `project_tasks.responsible_person_id`, which references a profile UUID. The UI can display profile name, email, and title, but the profile UUID is the authoritative identifier.

- Assigned tasks carry `assigneeId` when a profile UUID is present.
- Unassigned tasks carry no assignee UUID and render as unassigned in the UI.
- The existing `get_rebrand_task_assignees` RPC remains responsible for authorised assignee detail reads.
- Assignment updates resolve the selected user's email to a profile ID and write `responsible_person_id` as that UUID or `null`.
- Authentication and assignee RLS/RPC logic are outside this description and were not redesigned in the current migration phases.

## Project Journal and Activity

There are two activity representations during migration:

1. Legacy project history stored in `projects.activity` and project comments.
2. Relational append-only events stored in `project_activity`.

The relational activity helper now uses standard event names for the principal operational events:

- `project_updated`
- `task_status_changed`
- `file_uploaded`
- `file_updated`

Relational events include `workspace_id` in the activity row and `project_id` plus optional `task_id` in structured metadata. Task and file entities use their relational UUID where applicable. Legacy human-readable activity remains in the project record for compatibility and display.

The activity table is intended as an audit trail, not as a replacement for every legacy history entry yet. Full journal consolidation is a later architectural step.

## Security and Roles

Access is implemented through a combination of:

- Supabase Auth sessions
- profile records and role metadata
- grouped application permission policies
- project and workspace access checks
- Supabase Row Level Security
- authorised RPCs for restricted assignee reads
- private Storage buckets and signed file URLs

The principal role categories in the application include Colourpix administrators, PSG users/head office, PSG branch managers, and sign-company users. Role normalisation and the final role model are still subject to later migration work; this document describes current behavior, not the desired final policy model.

## Storage

Project files use the private `project-files` Storage bucket. File metadata is stored relationally in `project_files`; the current version points to `file_versions`. Downloads and previews use short-lived signed URLs where available.

Voice updates use the private `voice-updates` bucket and the `transcribe-voice-update` Edge Function. The function requires its own deployment and OpenAI configuration.

## Important Current Limitations

- Legacy JSON and relational writes still coexist. Some service methods update both representations during migration.
- The Phase 2 explicit workspace migration must be applied before live relational reads can use `projects.rebrand_workspace_id`.
- Existing live data may not contain a multi-project branch fixture, so isolation tests need a controlled staging fixture.
- Status compatibility names such as `busy`, `done`, and `open` remain in the domain model even though relational storage uses canonical database values.
- Some older or unused components still expose stage-name-oriented APIs. They are not the active project-detail resolver path.
- Supabase migration deployment is separate from the frontend build and static hosting deployment.

## Phase Progress

| Phase | Current position |
|---|---|
| Phase 0: baseline audit | Completed as the starting point for the migration |
| Phase 1: relational reads | Implemented in `portalService.ts` with explicit fallback handling |
| Phase 2: project/workspace relationship | Implemented in code and migration; database application remains an operational prerequisite |
| Phase 3: authoritative task IDs | Implemented in active detail and report paths |
| Phase 4: lossless statuses | Implemented for relational reads/writes and UI status indicators |
| Phase 5: assignees and telemetry | Implemented in the current service/domain paths; controlled persistence telemetry testing remains advisable |
| Phase 6 onward | Not started |

## How to Audit a Project End to End

For a specific project, record and compare:

1. `projects.id`, `projects.branch_id`, and `projects.rebrand_workspace_id`.
2. The matching `rebrand_workspaces.id` and `workspace_reference`.
3. Every `project_tasks.id`, `workspace_id`, raw database status, and `responsible_person_id`.
4. Every `project_files.id`, `workspace_id`, `task_id`, and current version.
5. The task IDs returned by `getProjectById()`.
6. The task ID selected by the project summary and stage checklist.
7. The task ID used by status, assignment, comment, file, delete, and reorder operations.
8. The related `project_activity` event's `workspace_id` and metadata `project_id`/`task_id`.

A healthy result has one explicit workspace per project, relational rows scoped to that workspace, stable task UUIDs throughout, no task selection by label, and no loss of `waiting` versus `blocked`.
