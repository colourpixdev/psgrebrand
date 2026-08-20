# PSG Rebrand: Current User Experience and Functional Audit Report

Date: 2026-08-20
Purpose: Provide a fact-based description of the currently implemented application for a separate UX, product, accessibility, security, and workflow audit.

## 1. Executive Summary

PSG Rebrand is an invitation-only operational workspace for managing PSG branch rebrand work. It is a React/Vite single-page application with Supabase Auth, PostgreSQL, and Storage support, plus a local/mock fallback when Supabase is not configured.

The main user concept is a branch rebrand project. A branch and its project are intended to be one operational workspace, although the application still contains separate Branches, Branch Detail, Projects, and Project Detail routes. The most complete workflow is the Project Detail screen, which combines branch identity, contacts, workflow stages, updates, history, questions, comments, files, and administrative controls.

The current visual language is a dark navy workspace with cyan, sky, emerald, amber, and red accents. A global CSS override layer attempts to normalize contrast across legacy light and dark Tailwind classes. The application recently received a contrast correction because some old rules forced dark text into navy panels.

Important current-state caveat: older documentation and generated/deployed screenshots may describe removed percentage progress bars, project notes, or permanently editable summary fields. Those are no longer the intended source behavior. The current source should be treated as authoritative.

## 2. Technical Shape

- Frontend: React 19, TypeScript, Vite.
- Routing: React Router with hash-based routing.
- Data fetching/cache: TanStack Query.
- Forms: React Hook Form and Zod.
- Styling: Tailwind CSS plus `src/styles.css` global overrides.
- Authentication: Supabase Auth when configured; local preview role sign-in is available only when explicitly enabled.
- Database: Supabase PostgreSQL through service modules.
- Storage: Private Supabase Storage for project files, accessed through signed URLs.
- Fallback: LocalStorage/mock data behavior when Supabase is unavailable.
- Deployment: GitHub Pages via the `main` branch and `.github/workflows/deploy-pages.yml`.

## 3. Application Shell and Navigation

Authenticated users see a persistent application shell:

- Desktop: left sidebar with brand, signed-in user identity, role label, navigation, and sign-out.
- Mobile: sticky top header with brand and sign-out icon, plus fixed bottom navigation.
- Main content: rounded dark navy content area with responsive padding and a footer.
- Global feedback: a fixed success/error toast is rendered by `SaveFeedbackProvider`.
- Focus styling: global focus-visible outlines are intended to make keyboard focus visible.

Current navigation items are configured in `src/App.tsx` and include:

- Dashboard
- Branches
- Reports
- Users
- Settings

Other routes exist but may be secondary or reached through links:

- Project list and project detail
- Branch detail
- Map
- Search
- Support
- Profile
- About
- Legal
- Access Controls
- Auth callback

The application therefore has both a branch-first navigation concept and a project-centric detail route. This remains a product/information-architecture issue for audit purposes.

## 4. Authentication and Roles

The application supports these domain roles:

- `colourpix_admin`
- `psg_user`
- `psg_head_office`
- `psg_branch_manager`
- `sign_company`

Some role labels are normalized for display, so several PSG-facing roles display as “PSG user.”

The current production-oriented access model is:

### Colourpix admin

- View all accessible projects.
- Create projects.
- Manage workflow and project details.
- Add, edit, reorder, and delete workflow stages/tasks.
- Complete tasks.
- Upload/delete files where policy allows.
- Answer questions.
- Export reports.
- Manage users and access controls.
- Delete projects where backend policy permits.
- Edit branch and project details in the current UI only when the signed-in profile name is Beverley or Francois. This name-based restriction is a notable implementation risk because it is separate from role-based authorization.

### PSG head office

- View all projects according to policy.
- View reports and export where policy allows.
- Add communication/questions according to policy.
- Does not receive the same workflow-edit permissions as the Colourpix admin role in the role policy.

### PSG branch manager

- View projects scoped to their branch.
- Read project, stage, file, and communication information subject to RLS and frontend filtering.
- Generally cannot edit workflow, project, or branch records.

### Sign company

- View projects scoped by installer/branch assignment according to policy and RLS.
- Generally cannot edit workflow or branch records.

### Preview/local behavior

When preview auth is explicitly enabled, the login screen can expose local role sign-in buttons. This should not be enabled in production.

## 5. Dashboard Experience

The Dashboard loads branches and projects, filters projects for the signed-in user, and displays:

- Total branches.
- Completed projects.
- In-progress projects.
- At-risk projects.
- Not-started projects.
- Awaiting-approval projects.
- Greeting and current user name.
- Count of projects in scope.

For internal management users, the main list is “My attention.” It includes projects that are delayed, on hold, or awaiting approval, with a link to open the project.

For non-internal users, the main list is “Recently updated.” It shows branch, current stage, status, and last update.

For non-internal users, the secondary panel is “Relevant branches.” Internal users no longer receive a second duplicate “Recent activity” project list after Checkpoint A cleanup.

Current dashboard limitations:

- It is still primarily a metric and shortcut page rather than a full action queue.
- It does not provide dedicated My Actions, Approvals, or Installations views.
- It derives many metrics in the browser from project records.
- It should be audited for whether “not started” based on current stage is sufficient.

## 6. Branches Experience

The Branches route acts as a branch directory, branch administration surface, and project launch surface.

Users can generally:

- Search branches.
- Filter branches by location/division/status-related fields.
- View branch information.
- Open an associated project.
- Create a branch where permitted.
- Edit branch fields and contacts where permitted.
- Delete a branch where permitted.
- Start/create a rebrand project from a branch.

Branch data includes:

- Branch name.
- Division.
- Province.
- Town.
- Physical address.
- Latitude and longitude.
- Legacy primary contact fields.
- Contact-person array with name, designation, email, and phone.

The Branches page has its own contact editing model, while Project Detail also has a branch/contact editing model. This is an intentional target for future simplification: two places can edit the same branch information.

## 7. Branch Detail Experience

Branch Detail loads the selected branch and all scoped projects associated with it. It can show:

- Branch name and location.
- Physical address.
- Contact persons.
- Number of rebrand records.
- Outstanding task count.
- File count.
- Recent branch/project updates.
- Project cards and current task information.
- Quick update composer.
- Task files, previews, downloads, uploads, and deletes where allowed.
- Link to open the project detail workspace.

If an associated project exists, the route may redirect to Project Detail because the project is the primary operational workspace. This creates a potential duplication/redirect complexity that should be evaluated in the audit.

## 8. Project List Experience

The Projects route provides:

- Project creation for users with create permission.
- Search by branch, town, or province.
- Province filter.
- Stage filter.
- Status filter.
- Completion filter.
- Project table.
- Links to open project detail.

The numeric project percentage feature has been intentionally removed from the current UI. The legacy database field may still exist for compatibility, but it should not be treated as an active user-facing feature.

## 9. Project Detail: Top Workspace

Project Detail is the primary operational screen. The top workspace card currently shows:

- Branch rebrand workspace label.
- Branch name.
- Town/province.
- Project status badge.
- Branch and contact persons.
- Current stage.
- Target completion date.
- Installation date.
- “What’s next?” derived from current stage and ordered stages.
- Stage checklist.
- Latest update.
- Project history.

### Branch and contact display

Read-only mode shows:

- Branch name.
- Division.
- Town/province.
- Physical address.
- Contact people, designation, email, and phone.

Only Beverley and Francois, identified by profile name in the current implementation, see the Edit details button.

### Unified edit mode

The Edit details mode is intended to be the one combined editing surface. It includes:

- Branch name.
- Division.
- Province.
- Town.
- Branch address.
- Contact persons with name, designation, email, and phone.
- Current project stage.
- Project status.
- Target date.
- Brief requested date.
- Installation date.
- Completion date.
- Save details.
- Cancel.
- Delete project, where the signed-in user has delete permission.

On successful save, the edit mode closes and the read-only view is shown again. A global confirmation toast should appear.

## 10. Stage Checklist and Workflow

The stage checklist is an ordered workflow representation based on project tasks/stages.

Each stage can now be controlled directly in the checklist without first expanding the stage accordion:

- Pending.
- Started.
- Busy.
- Completed.

Each stage also has direct up/down controls for reordering. The controls are shown to users who can add/manage tasks.

The current UI also retains an expanded Stages section below the top summary. That section provides more detailed stage/task operations:

- Expand/collapse all.
- Add suggested stage.
- Add custom stage.
- Edit stage text.
- Delete stage.
- Change task status.
- Move stage up/down.
- Upload task files.
- View task comments and updates.
- Add task comments.
- Installation instructions for installation-related tasks.

This creates possible duplicate stage controls: the top checklist now has status and reorder controls, while the expanded stage accordion still has status and reorder controls. The user experience audit should decide whether the expanded controls should be reduced to advanced task details only.

### Stage suggestions

The stage picker includes suggested operational stages such as:

- Site Survey.
- Measurements Received.
- Design Brief Confirmed.
- Artwork In Progress.
- Artwork Sent.
- Quotation Received.
- PO Issued.
- Supplier Assigned.
- Materials Ordered.
- Delivery Scheduled.
- Production.
- Installation Scheduled.
- Installation In Progress.
- Installation Issue.
- Rework Required.
- Installed.
- Final Inspection.
- Photos Uploaded.
- Client Signoff.
- Handover Complete.
- Completed.
- Cancelled.

Stages already present in the project are hidden from the suggestion list. A custom stage option remains available.

## 11. Status Semantics

Project status and stage/task status are separate concepts.

Project-level status examples:

- In progress.
- Busy.
- Awaiting approval.
- Completed.
- Delayed.
- On hold.
- Cancelled.

Stage/task status labels in the current UI:

- Pending.
- Started.
- Busy.
- Completed.

The relational task mapping is currently:

- Pending -> `not_started`.
- Started -> `waiting`.
- Busy -> `in_progress`.
- Completed -> `complete`.

This mapping should be reviewed because `waiting` semantically may mean “waiting for information” rather than “started.” A dedicated relational `started` state would be clearer if the schema permits it.

## 12. Updates, Questions, and History

Project Detail includes a communication area with:

- General project update composer.
- Optional related stage selector.
- Save update action.
- Send request/question action.
- Project questions.
- Answer forms for permitted users.
- Stage/status/date changes attached to answers.
- Mark-answer-read action.
- Project history generated from comments and activity records.

“Latest update” is a compact snapshot in the top workspace. “Project history” is a more detailed chronological record lower in that same top workspace. These are related but not identical: one is a latest-item summary and one is a list.

Potential audit question: whether “Latest update,” “Project history,” “Progress updates,” task comments, and activity entries are too many overlapping communication surfaces.

## 13. Files

Files are available through a shared FileGrid and task-level file sections.

Supported operations include:

- Upload.
- Preview.
- Download.
- Rename.
- Delete.
- Task association.
- Thumbnail/preview loading for supported files.

Files are intended to be stored in a private bucket and accessed through signed links. The UI shows success confirmation for upload, rename, and delete in the main supported flows.

Potential duplication:

- Files can be accessed through the shared FileGrid and within individual task accordions.
- This is useful when task context matters, but a UX audit should decide whether task-level file actions need to repeat all global file actions.

## 14. Reports

Reports provides filtering and export functionality.

Filters include:

- Status.
- Province.
- Completion state.
- Search.
- Branch suggestions.

Outputs include:

- Report preview table.
- CSV/Excel-style export.
- Printable/PDF-style HTML report.
- Single-branch detail report path exists in the report code.

The removed numeric project percentage should not appear in current reports. Reports still expose stage, status, target date, pending tasks, files, participants, manager, and update information.

## 15. Users and Access Controls

Users provides administrative user/invite workflows. Access Controls provides:

- Role assignment.
- Per-user permission overrides.
- Capability groups for project access, workflow, communication, files, tasks, reports, user management, and notifications.
- Save confirmation after access-control changes.

There is a potential mismatch between visible role labels, normalized roles, permission policy defaults, and the special profile-name checks for Beverley and Francois. This should be a priority security audit item.

## 16. Profile, Settings, Support, Map, Search

### Profile

Users can edit:

- Display name.
- Title/responsibility.
- Company/organisation.
- Avatar URL.
- Organisation logo URL.

The page shows a live preview and success notice/toast.

### Settings

Settings is primarily a workspace/system configuration and status surface. Audit whether it exposes meaningful operational settings or mostly technical diagnostics.

### Support

Support provides a support/contact workflow. It should be checked for persistence, confirmation, and whether submissions create a durable record.

### Map

Map visualizes branch/project locations using Leaflet. Audit coordinate accuracy, fallback coordinates, marker clarity, and keyboard alternatives.

### Search

Search provides project/branch search. Audit whether users expect it to search tasks, files, comments, questions, and activity as well as project fields.

## 17. Visual Design and Color System

The app uses:

- Very dark navy page and panel backgrounds.
- Cyan and sky blue as primary accents.
- Emerald for success/completed states.
- Amber for approval/warning states.
- Red for destructive/error states.
- Light slate/cyan text for dark surfaces.

The app previously had conflicting CSS rules that changed dark panels into dark navy backgrounds while leaving text classes such as `text-slate-900` or `text-white` in place. This produced black or overly dark text on navy backgrounds. A final contrast guard was added to `src/styles.css`.

Accessibility target used for the correction:

- WCAG 2.2 AA normal text: at least 4.5:1.
- WCAG 2.2 AA large text: at least 3:1.
- WCAG 2.2 AA UI boundaries and meaningful non-text controls: at least 3:1.

The contrast fix should still be verified with automated browser contrast tooling because global selector overrides are broad and may produce unintended combinations on buttons, badges, and light-colored accent surfaces.

## 18. Feedback and Save Confirmation

A global `SaveFeedbackProvider` renders a fixed toast for success and error messages.

Success feedback is used for many actions, including:

- Project creation.
- Project detail saves.
- Branch saves.
- Contact saves.
- Stage addition.
- Stage edits.
- Stage ordering.
- Comments/updates.
- File uploads, renames, and deletes.
- Profile saves.
- User invites.
- Access-control saves.
- Project deletion.

Project Detail success feedback is intentionally shown immediately after a successful mutation response, before cache invalidation completes, so slow refreshes do not make the action look inert.

Audit remaining silent paths, especially actions that open/download/preview data and mutations in less frequently used pages.

## 19. Data and Persistence Model

The frontend domain model includes Branch, Project, TaskItem, CommentItem, ProjectFile, ActivityItem, UserRecord, and permissions.

Project records still carry a large amount of nested JSON-style data:

- Tasks.
- Comments.
- Files.
- Activity.

Some operations also use relational tables such as project tasks, workspaces, project files, and file versions. The service layer contains compatibility fallbacks for schema drift and legacy columns.

Legacy fields still exist for compatibility even when removed from the UI, including the project numeric `progress` field and project `notes` storage. The current user-facing UI no longer intentionally exposes those features.

## 20. Security and Authorization Audit Targets

High-priority audit questions:

1. Are branch/project edit permissions enforced in Supabase RLS or only by frontend checks?
2. Is the special Beverley/Francois name check safe, or should it be replaced by user IDs/emails/claims/permissions?
3. Does project deletion enforce the same role decision in the database?
4. Can users alter task statuses or reorder stages by calling APIs directly?
5. Are signed file URLs issued only to users who can view the project?
6. Do local fallback records risk exposing or retaining sensitive project data in browser storage?
7. Does the invite Edge Function enforce admin authorization independently of the UI?
8. Does the current role normalization collapse distinct roles in ways that weaken permissions?
9. Do schema fallback paths accidentally omit security-relevant columns?
10. Are notification and failed-delivery queues free of sensitive data leakage?

## 21. Accessibility Audit Targets

1. Verify every text/background pair with automated contrast checks.
2. Check the global CSS override behavior on dark panels, light panels, accent buttons, badges, and tables.
3. Check keyboard access to stage reorder controls, status selectors, accordions, upload controls, and destructive actions.
4. Ensure every icon-only control has an accessible name.
5. Ensure focus outlines remain visible against both dark and accent backgrounds.
6. Check status meaning is not conveyed by color alone; labels and symbols should remain present.
7. Check mobile bottom navigation does not cover form buttons or file controls.
8. Check long branch names, contact details, and stage names wrap without layout shifts.
9. Check date inputs and native calendar affordances in all supported browsers.
10. Check that error and success toasts are announced to assistive technology, not only visually displayed.

## 22. Product and UX Simplification Audit Targets

1. Decide whether Branch Detail should remain separate when it redirects to Project Detail for an active project.
2. Decide whether Branches page editing and Project Detail editing should share one contact editor.
3. Remove or consolidate duplicate stage controls between the top checklist and expanded Stages section.
4. Decide whether Latest update, Project history, Progress updates, comments, questions, and activity should be unified into a single communication model.
5. Decide whether FileGrid and task-level file controls should both expose rename/delete/preview actions.
6. Decide whether Projects should remain a user-facing route or become an admin portfolio view.
7. Decide whether Reports should remain separate from Dashboard; current architecture keeps them separate.
8. Replace name-based edit authorization with a durable permission capability.
9. Clarify “Started” versus the relational `waiting` status.
10. Remove stale documentation that still describes percentage progress and project notes as active UI features.

## 23. Suggested ChatGPT Audit Prompt

Use this prompt with the report:

> You are auditing the current PSG Rebrand application as a senior product designer, accessibility specialist, security reviewer, and operations workflow expert. Treat the attached current-app-user-experience-report.md as a description of the implemented product, not a wishlist. Identify contradictions, duplicate functionality, confusing terminology, unsafe authorization assumptions, missing user feedback, accessibility failures, data-model risks, and workflow gaps. Rank findings as Critical, High, Medium, or Low. For each finding explain the affected user, the exact screen/workflow, why it matters, and a concrete recommendation. Separate confirmed implementation behavior from questions that require browser/database verification. Pay special attention to the branch/project duplication, stage controls, status semantics, role-based editing, contrast, file operations, notifications, reports, and delete behavior.

## 24. Current Verification

The latest implementation was type-checked and production-built during the preparation of this report. The live deployment should still be tested in a fresh browser session after GitHub Pages propagation because cached generated assets can show an older UI.
