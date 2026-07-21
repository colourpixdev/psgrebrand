# RolloutHQ™: Product Overview for Guidance

## Executive Summary

RolloutHQ™ is intended to be a secure, role-aware project workspace platform for managing repeatable work across separate client workspaces. The application is licensed software, with the first workspace configured for the PSG National Signage Rollout and Colourpix CC positioned as the default service partner at this stage. PSG signage is the first proof-of-concept template, not the limit of the product. Its purpose is to replace scattered spreadsheets, WhatsApp messages, email threads, and manual status chasing with one shared project record for every site, location, customer request, rollout item, or delivery job.

The platform gives platform owners, workspace administrators, client administrators, site contacts, and delivery partners a controlled view of the project work relevant to them. It tracks each project from initial setup through information gathering, approvals, quotations, production or delivery, evidence, signoff, and completion.

The current version is a working production-oriented scaffold connected to Supabase for authentication, project data, file storage, role-based access, and live project updates. It already supports dashboard reporting, project workflow management, project templates, file uploads, comments, project Q&A requests, voice-note batch updates, search, maps, reports, and user profile management.

## Intended Use

The app is intended to serve as the single operational source of truth for managed projects across multiple client workspaces. PSG signage is the current active workspace and default template, but the product is intended to support other private, public, signage, service delivery, facilities, operations, and multi-location project workflows over time.

It should help the business answer questions such as:

- Which sites, jobs, requests, or locations are in progress, delayed, awaiting approval, or completed?
- What stage is each project currently at?
- Who is responsible for the next action?
- Which projects need client approval, design confirmation, a purchase order, evidence, or signoff?
- Which delivery partner, service partner, or supplier is assigned?
- What journal entries, files, questions, tasks, decisions, and activity belong to each project?
- Which client users are waiting for an answer from the design partner?
- What has changed recently, and who made the update?

The authenticated workspace is not meant to be a public website. It is an internal operational tool for managing project delivery and communicating status clearly between clients, workspace administrators, service partners, and suppliers. The public landing page may collect quote, access, and new-workspace requests, which can then be reviewed before users are invited.

Every signed-in user should also have a clear support channel. Project or workspace questions should go to the workspace administrator. Product support, functionality requests, report customization requests, workflow/template suggestions, and technical issues should go to RolloutHQ support with the workspace administrator copied so requests can be approved before implementation.

## Workspace Model

RolloutHQ™ should support separate client workspaces so users only see the projects they are meant to see. A workspace can represent a national client rollout, a regional programme, a public works programme, a signage deployment, a service-delivery queue, or a dedicated customer environment.

The current default workspace is PSG National Signage Rollout. Future workspaces should carry at least:

- Workspace name
- Client company
- Default service partner
- Member users
- Platform administrators
- Project records and journal entries scoped to that workspace

The platform owner and nominated senior workspace administrators should have all-workspace administrative access. Other users should belong only to the specific workspaces they are invited into. Colourpix CC is currently the default service partner for all workspaces and should be presented as "in partnership with Colourpix CC" rather than as the licence owner.

## Project Templates and SaaS Direction

RolloutHQ™ should be treated as a configurable service that can be sold or resold to companies that need controlled project workspaces. The platform should support project templates so each workspace can use language and workflows that match the work being managed.

Current template direction:

- Signage rollout: multi-site signage, graphics, approvals, production, installation, photos, and signoff.
- General rollout: repeatable delivery across locations, departments, customers, or operational sites.
- Service delivery: customer requests, supplier updates, approvals, operational tasks, and closeout records.

The code should continue to preserve legacy database field names such as branch and installer where they already exist, but the user interface should increasingly display generic labels such as site, location, delivery partner, service partner, workspace administrator, client administrator, and site contact.

## Recommended Product Direction: One Project Journal

The strongest long-term direction for RolloutHQ™ is to treat every project as a chronological Project Journal.

Instead of thinking of Comments, Questions, Notes, Activity, Files, Tasks, Voice Updates, and Timeline as separate modules, the platform should increasingly treat them as different types of entries in one living project feed.

Every significant event would become a timestamped journal entry, for example:

- Project created
- Survey uploaded
- Client question asked
- Workspace answer posted
- Stage changed
- File uploaded
- Voice-note transcript processed
- AI suggestion applied
- Task assigned
- Delivery partner update received
- Installation photos uploaded
- Client signed off
- Project completed

This would make the Project Journal the complete story of the project from start to finish.

### Why This Matters

A unified journal would give the portal three major advantages:

- A complete audit trail that explains exactly what happened and when.
- Better reporting, because every event has structured metadata.
- AI-ready project history, allowing the system to summarise progress, identify bottlenecks, measure response times, and answer questions such as "Why is this project delayed?"

### Journal Entry Types

Journal entries could include:

- Comment
- Question
- Answer
- File upload
- Task
- Voice note
- Status change
- Photo upload
- Report
- Email
- SMS
- WhatsApp message
- Meeting note
- Phone call
- Installation update
- Approval
- Decision

The user experience would feel similar to a professional activity feed: one timeline, different entry types, clear filters, and threaded replies where needed.

### Metadata On Every Entry

Every journal entry should carry structured metadata:

- Date
- Time
- User
- Role
- Type
- Visibility
- Related stage
- Attachments
- Tags
- Linked project fields
- Linked decisions or approvals

This metadata is what makes reporting powerful. For example, the business could later report on all client questions in June, all delivery-partner uploaded files last month, average response time from client question to workspace answer, or all projects with repeated communication and delayed status.

### Visibility Rules

Not every journal entry should be visible to every user.

Recommended visibility options:

- Workspace administrators only
- Client and workspace administrators
- Delivery partner and workspace administrators
- Everyone on the project

This allows one journal to support internal notes, supplier communication, client-facing updates, and general project activity without splitting the project record across separate places.

### Threaded Discussions

Some journal entries should support replies. A client question, for example, may need a short conversation before it is closed.

Example:

- Question: Has the landlord approved the fascia?
- Reply: Yes, approval received this morning.
- Reply: Approval letter uploaded.
- Reply: Waiting on final signature.
- Reply: Approved and closed.

In the journal, this can display as one question entry with expandable replies, similar to Microsoft Teams or GitHub discussions.

### AI Summaries

Once all meaningful events live in one structured journal, the portal can generate a project summary at the top of each project.

Example summary:

> Project currently sits in Production. Artwork was approved on 4 July. Quote accepted. Delivery scheduled for 18 July. No outstanding client questions. One delivery-partner task is overdue. Waiting for completion evidence.

This would help managers understand the current position without reading a long history manually.

### Meeting Minutes and Bulk Updates

The same journal model can support uploaded meeting transcripts or voice notes.

For example, Beverley could upload a Teams transcript. AI could identify projects discussed, summarise actions, extract deadlines, assign responsible people, and create journal entries against the relevant projects.

This would turn meetings and voice updates into structured operational records instead of leaving them as unsearchable notes.

### Decision Log

One important journal entry type should be a Decision.

Example:

- Decision: Replace illuminated sign with ACM panel
- Reason: Budget constraints
- Approved by: Client Administrator
- Linked document: Quote 241.pdf

This prevents later disputes or uncertainty about who approved a change and why.

### Journal Filters, Search, and Export

Every project journal should support filtering by entry type, user, role, visibility, date range, stage, tag, and attachment.

Users should be able to filter the project history to show only comments, files, questions, photos, voice updates, tasks, approvals, or decisions.

The journal should also be searchable. Searching for "approval" should return entries such as landlord approval uploaded, artwork approval received, or quote approval received.

For dispute resolution or management review, each project should be exportable as a chronological PDF report containing project details, timeline, communication, files, tasks, photos, questions, approvals, decisions, and signoff.

## Recommended Policy Structure

The platform should avoid a single flat list of permissions. Each role should be governed by a grouped policy so management can understand exactly what each user type may do.

Recommended policy categories:

- Project access
- Workflow permissions
- Communication permissions
- Files
- Tasks
- Reports
- User management
- Notifications

This structure has now been introduced in the app code as a role policy model. The user interface can still expose simple actions, but those actions should be checked against the grouped policy before they are allowed.

### Project Access Policy

Project access should define whether a role can:

- View assigned projects
- View all projects
- Create projects
- Archive projects
- Delete projects
- Export a project
- Duplicate a project

### Workflow Policy

Workflow policy should define whether a role can:

- Change project stage
- Change project status
- Change progress
- Mark a project completed
- Reopen completed projects
- Change target dates

Business rules should then sit on top of these permissions. For example, a delivery partner may be allowed to change stage, but only within the delivery sequence: Production to Scheduled, then In Progress, then Delivered.

### Communication Policy

Communication policy should define whether a role can:

- Create comments
- Reply
- Edit their own comments
- Delete their own comments
- Delete other users' comments
- Ask questions
- Answer questions
- Close questions
- Mention users
- Create internal notes

For example, site contacts should be able to ask workspace questions, but should not answer questions, delete communication, or create internal workspace notes.

### File Policy

File policy should define whether a role can:

- Upload files
- Download files
- Delete files
- Replace files

The recommended allowed operational file types are:

- PDF
- DOCX
- XLSX
- JPG
- PNG
- DWG
- AI

### Task Policy

Task policy should define whether a role can:

- Create tasks
- Assign tasks
- Complete tasks
- Delete tasks
- Reassign tasks

### Report Policy

Report policy should define whether a role can:

- View reports
- Export reports
- Create custom reports
- Schedule reports

### User Management Policy

User management policy should define whether a role can:

- Invite users
- Disable users
- Edit users
- Reset passwords

### Notification Policy

Notification policy should define which channels a role receives and which events trigger notifications.

Possible channels:

- Email
- In-app
- SMS
- WhatsApp

Possible notification events:

- Question
- Task
- Project updated
- Stage changed
- File uploaded

### Capability-Based Permissions

The long-term model should be capability-based rather than hard-coding every rule directly into a role.

Example capability:

| Capability | Workspace Administrator | Client Administrator | Site Contact | Delivery Partner |
| --- | --- | --- | --- | --- |
| Change project stage | Yes | Limited | No | Limited |
| Upload files | Yes | Yes | Yes | Yes |
| Answer client questions | Yes | No | No | No |
| Invite users | Yes | No | No | No |

This makes it easier to add a new role later without rewriting the whole permission system.

## Recommended System Policy Engine

Every user action should be evaluated against the active role policy before it is executed.

Recommended execution order:

1. Identify the user role.
2. Load the role policy.
3. Load project permissions.
4. Check project ownership or assignment.
5. Check the requested action.
6. If permitted, execute the action.
7. If denied, do not perform the action, explain why, and suggest who has permission.
8. Record every successful action in the Project Journal.

### Communication Rules

Every communication should become a Project Journal entry. Journal entries should be immutable. Editing should create a new revision. Deletion should require administrator permission.

Every communication entry should record:

- Timestamp
- User
- Role
- Action
- Visibility
- Project stage
- Attachments
- IP address, if required
- Previous value, where applicable
- New value, where applicable
- Related project

### Visibility Rules

Every journal entry should have a visibility level:

- Internal: visible only to workspace administrators
- Operational: visible to workspace administrators and delivery partners
- Client: visible to client users
- Public project: visible to everyone assigned to the project
- Administrator: visible only to administrators

### Reporting Rules

Every journal entry should include metadata that is searchable and filterable:

- Entry type
- Category
- Stage
- Project
- Site or location
- Province
- Author
- Role
- Status
- Date
- Time
- Visibility
- Tags
- Attachments
- Linked question
- Linked task

### AI Behaviour Rules

AI should never delete historical communication. It may suggest corrections, merge duplicate entries, summarise communication, classify entries, tag communication, extract actions, identify unanswered questions, identify overdue actions, generate management summaries, and generate reports.

The AI must preserve the original communication exactly as submitted.

### Status Change Rules

Whenever a project stage changes, the system should automatically create a journal entry recording:

- Old stage
- New stage
- Reason
- User
- Timestamp
- Comments supplied
- Files attached

The system should also recalculate:

- Progress
- Health status
- Expected completion
- Overdue status
- Notifications
- Related tasks

### Administrator Rules

Workspace administrators should be able to:

- Modify any project
- Override workflow rules
- Edit user permissions
- Create new roles
- Create new policies
- Lock and unlock projects
- Delete users
- Archive and restore projects
- Configure notifications
- Create custom workflow stages
- Create report templates
- Export all data
- Modify security policies
- View the complete audit log

## User Groups and Access

The portal currently supports four main role types. The internal role keys still use legacy PSG/Colourpix names for compatibility, but the visible product model should be generic.

| Role | Intended User | Current Access |
| --- | --- | --- |
| Workspace Administrator | Francois, Beverley, Colourpix, or the workspace operations team | Full project visibility, project creation, workflow updates, file uploads, comments, tasks, voice updates, user management, settings, reports, and answering client questions |
| Client Administrator | Client head office or central stakeholders | Full workspace visibility, reports, project visibility, voice updates, comments, tasks, and ability to ask project questions |
| Site Contact | Individual site, branch, location, or department users | Scoped project visibility for their site, uploads/comments, reports, and ability to ask project questions |
| Delivery Partner | External installer, supplier, contractor, or service partner | Scoped project visibility for assigned projects, workflow updates, uploads, comments, and tasks |

Role-scoped access is enforced through the portal UI and Supabase row-level security policies. Workspace administrators and client administrators can see all relevant workspace projects. Site contacts and delivery partners are limited to the projects relevant to them.

## Main Capabilities

### 1. Secure Sign-In and Role-Based Portal Access

Users sign in with Supabase Auth using email and password. After login, the portal resolves each user's profile, role, site scope, workspace membership, and permissions from the Supabase profiles table.

The navigation automatically changes depending on role. For example, workspace administrators can access user management and settings, while site contacts only see the operational areas relevant to their role.

### 2. Dashboard

The dashboard provides a high-level operational snapshot of the active workspace.

It currently shows:

- Total projects visible to the signed-in user
- Completed projects
- Projects in progress
- Projects awaiting approval
- Delayed projects
- Recent project activity
- Current open tasks

The dashboard is intended to give managers a fast view of project health without opening every project individually.

### 3. Project List and Kanban Workflow Board

The Projects page shows workspace projects in two ways:

- A kanban-style workflow board grouped by project phase
- Project cards with site, location, manager, delivery partner, project type, target date, progress, and communication badges

Workspace administrators, client administrators, and other permitted users can move projects through stages where their role allows it.

The default signage rollout stages currently include:

- New Project
- Awaiting Information
- Site Survey
- Measurements Received
- Artwork In Progress
- Artwork Sent
- Awaiting Approval
- Approved
- Quotation Requested
- Quotation Received
- PO Issued
- Production
- Installation Scheduled
- Installation In Progress
- Installed
- Photos Uploaded
- Client Signoff
- Completed

Project cards and kanban cards now also show project communication indicators such as open client questions and unread workspace-team answers.

### 4. Project Detail Records

Each project has a detailed project record containing:

- Site/location and project identity
- Province and town
- Manager and delivery partner
- Current stage and status
- Progress percentage
- Target, installation, and completion dates
- Workflow timeline
- Tasks
- Project notes
- Activity history
- Uploaded files
- Communication log
- Client-to-workspace project questions

The project detail page is intended to be the main working record for a project. The recommended direction is to evolve this page into a single Project Journal where timeline updates, communication, files, questions, tasks, voice updates, photos, approvals, and decisions all appear as chronological entries.

### 5. Workflow Updates

Permitted users can update a project's stage, status, and progress. Updates are saved to Supabase and added to the activity history so the project record shows what changed.

This is intended to reduce manual status chasing and give clients, workspace administrators, and delivery partners a shared view of where each project stands.

### 6. Tasks

Project tasks can be added, edited, completed, reopened, or deleted by permitted roles.

Tasks are intended for operational next actions such as:

- Confirm site contacts
- Request site or landlord requirements
- Follow up on artwork approval
- Confirm purchase order
- Upload delivery or installation evidence
- Complete client signoff

### 7. File Uploads and Downloads

Project files upload to a private Supabase Storage bucket. File metadata is stored against the project, and downloads use short-lived signed links.

Supported project file types include:

- PDF
- Excel
- Word
- JPG
- PNG
- WebP

This is intended for documents such as surveys, quotations, artwork, purchase orders, site photos, delivery evidence, and signoff records.

### 8. Communication Log

Each project has a general communication log where users can add comments and updates. This is useful for routine notes that should remain attached to the project rather than disappearing into email or chat history.

In the recommended journal model, this communication log would become part of the wider Project Journal rather than a separate section.

### 9. Client Project Questions and Workspace Answers

The portal now includes a project-specific Q&A workflow.

This is intended for cases where a client needs a direct answer or status clarification from the workspace team, for example:

- "Please confirm whether artwork approval is still blocking this stage."
- "When is delivery expected for this site?"
- "Has the quote been received yet?"
- "Can the workspace team confirm whether the project has moved to production?"

Current flow:

1. A client user opens a project.
2. The client user asks the workspace team a question, optionally linked to a project stage.
3. The workspace team sees the open question on the project record.
4. The workspace team can answer the question.
5. The workspace team can also amend the project details while answering, including stage, status, progress, target date, and delivery date.
6. The requester receives a "new answer" notification in the portal.
7. The requester can open the project, read the answer, and mark it as read.

This is intended to create basic instant project communication without needing a separate messaging platform.

In the recommended journal model, a client question would be a journal entry with metadata, visibility, threaded replies, status, attachments, and response-time reporting.

### 10. Voice Updates

The Voice Updates page is intended for batch updates from a spoken or pasted status update.

Current capabilities include:

- Dictating text in the browser where supported
- Pasting transcript text manually
- Uploading audio files such as WhatsApp voice notes, MP3, WAV, OGG, WebM, AAC, or MP4 audio
- Sending audio to a Supabase Edge Function for transcription
- Matching transcript segments to projects
- Inferring likely stage, status, dates, comments, and tasks
- Reviewing suggested updates before saving
- Applying selected updates to projects in a batch
- Adding structured manual updates when a transcript does not identify the project clearly

This is intended for managers who receive several updates verbally and want to turn them into project updates quickly, while still requiring review before saving.

In the recommended journal model, the uploaded voice note, transcript, AI suggestions, accepted changes, and applied-by user would all become journal entries linked to the relevant projects.

### 11. Search

The Search page lets users search across their visible projects by:

- Site or location
- Town
- Province
- Delivery partner
- Project ID
- Stage
- Status
- Manager

This helps users quickly locate a project without scrolling through the full project list.

### 12. Map View

The Map page shows site/project locations across South Africa and Namibia, with markers coloured by project status.

It includes:

- Interactive map markers
- Status counts
- Site location list
- Links from map items to project records

This is intended to give management and operations a geographic view of project progress.

### 13. Reports

The Reports page supports filtered reporting and exports.

Current report types include:

- Workspace summary
- Completed projects
- Delayed and at-risk projects
- Outstanding quotes
- Awaiting approval
- Delivery schedule
- Evidence and signoff
- Delivery partner performance

Reports can be filtered by status, stage, province, delivery partner, date range, and search text. The page supports Excel download and printable/PDF-style report output.

### 14. User Management

Workspace administrators can manage user profile records for administrators, client users, site contacts, and delivery partners.

The app also includes an invite-user Edge Function path for inviting users through Supabase Auth, subject to deployment and configuration.

### 15. Settings and Security Visibility

The Settings page shows authentication and Supabase configuration status, including whether the workspace is using Supabase Auth or local preview mode.

The app is designed with:

- Supabase Auth sessions
- Profile-based role resolution
- Row-level security
- Private storage buckets
- Role-scoped project access
- Signed file download links

### 16. Support and Customization Requests

The Support page gives all signed-in roles a structured way to contact either the workspace administrator or RolloutHQ support.

Current support request types include:

- Project or update help
- Workspace access or data questions
- Functionality requests
- Report customization
- Workflow or template changes
- Technical issues

The page routes project/workspace help to the workspace administrator and copies RolloutHQ support so repeated needs can be tracked. Product, report, workflow, template, and technical requests route to RolloutHQ support and copy the workspace administrator. The email body includes the user, role, workspace, related project, request type, urgency, details, expected outcome, and an approval note.

The long-term product direction should store these requests as structured support records so RolloutHQ can measure demand, discover customization opportunities, and identify reusable features across workspaces.

### 17. Profile and Workspace Branding

Users should be able to control how they appear inside a workspace without receiving permission to change their role or access scope. The current UI supports a local-first editable profile identity with display name, title, company, avatar URL, and organisation logo URL. These fields are also represented as optional Supabase profile columns for a future live profile editor.

Recommended administration boundaries:

- RolloutHQ platform owner: controls platform-level roles, workspace creation, global support routing, product configuration, and reusable features.
- Workspace administrator: manages workspace branding, client/project records, delivery partners, and user membership for that workspace.
- Client administrator: approves client-side users, report needs, workflow changes, and feature requests inside their workspace.
- Site contact and delivery partner: maintain their own avatar/profile identity and request changes through Support.

Workspace branding should support a client logo and a workspace administrator/service partner logo. The PSG/Colourpix workspace is the first example; future workspaces should be able to replace those marks without changing RolloutHQ platform branding.

## Current Technical Foundation

The app is built with:

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase Edge Functions

The current data model uses a `projects` table with JSON fields for files, tasks, comments, and activity. This has allowed rapid development of operational features without requiring a new table for every workflow.

For the next major version, the recommended architecture is to introduce a formal `project_journal_entries` model. Instead of storing operational history across separate JSON fields, each event would be stored as a structured journal entry with type, timestamp, user, role, visibility, related stage, attachments, tags, and optional threaded replies.

This would make the portal more scalable for audit trails, reporting, AI summaries, response-time measurement, dispute resolution, and long-term operational history.

## What Is Working Now

The current version supports the following working flows:

- User login through Supabase Auth
- Role-based navigation and project visibility
- Dashboard metrics from live projects
- Project list and kanban views
- Project detail pages
- Workflow stage/status/progress updates
- Project tasks
- Project comments
- Project file uploads and signed downloads
- Client-to-workspace project questions
- Workspace answers with optional project amendments
- Portal notifications for answered client questions
- Basic project history through comments, activity, tasks, files, and question records
- Search
- Map view
- Reports and exports
- User profile management
- Voice transcript and voice-note update review flow
- Support and customization request routing

The Project Journal described above is a recommended product direction. It is not yet fully implemented as one unified feed.

## Items That Need Business Guidance

The platform is far enough along that the next step should be business guidance rather than only technical work. Recommended questions for management:

### 1. Which Users Should Get Access First?

Confirm whether the first customer workspace should include:

- Workspace administrators only
- Workspace administrators plus client administrators
- Workspace administrators plus selected site contacts
- Delivery partners from the start or later

### 2. Who Is Allowed To Change Official Project Status?

Current permissions allow multiple operational roles to update workflow fields. Management should confirm whether official status changes should be limited to workspace administrators, client administrators, delivery partners, or a combination.

### 3. Should Site Contacts Only Ask Questions, Or Also Upload Files And Comment?

Site contacts currently have scoped project access and can add comments/uploads where permitted. Confirm whether that is appropriate or whether their role should be more restricted.

### 4. What Counts As An Official Notification?

The portal currently shows in-app notifications for answered project questions. Management should decide whether notifications should also be sent by email, SMS, WhatsApp, or Microsoft Teams.

### 5. Should Project Q&A Become A Formal Ticketing Workflow?

The current Q&A flow is lightweight. Management should decide whether questions need:

- Priority levels
- Due dates
- Assigned owners
- Escalation rules
- Closed/reopened states
- SLA reporting

### 6. Should The Portal Move Toward A Unified Project Journal?

Management should confirm whether the long-term product direction should be a single chronological Project Journal rather than separate comments, questions, tasks, files, activity, and voice update sections.

If approved, the next design phase should define:

- Journal entry types
- Required metadata
- Visibility rules
- Threaded replies
- Filters
- Search
- Export format
- AI summary requirements
- Decision log requirements

### 7. What Visibility Rules Are Needed?

The journal model depends on clear visibility rules. Management should confirm which types of entries should be visible to:

- Workspace administrators only
- Client and workspace administrators
- Delivery partner and workspace administrators
- Everyone on the project

This is especially important for internal notes, supplier issues, pricing discussions, client-facing updates, and dispute-sensitive decisions.

### 8. Should The Portal Include A Formal Decision Log?

Management should decide whether important project decisions must be captured as structured entries, including decision, reason, approver, date, and linked documents.

This would help answer future questions such as "Who approved this change?", "Why was this option selected?", or "Which quote did the client approve?"

### 9. What AI Summaries Would Be Useful?

If the project journal becomes the central record, AI could generate summaries such as:

- Current project status
- Outstanding blockers
- Last client question and response
- Missing files or approvals
- Overdue tasks
- Reason for delay
- Weekly management summary

Management should confirm which summaries would be useful and whether they should be visible to all roles or only internal users.

### 10. What Reports Are Required For Weekly Management Meetings?

The reports page has several useful report types, but management should confirm the exact weekly/monthly reports needed and what format they expect.

The journal model would also enable more advanced reports, for example:

- Client questions by date range and province
- Average response time from client question to workspace answer
- Files uploaded by delivery partners last month
- Projects with more than 10 communication entries and delayed status
- Decisions made by client administrators
- Open approvals by stage

### 11. What Is The Authoritative List Of Project Stages?

The current stage list is detailed and operational. Management should confirm whether each workspace should use the signage template stages, a general rollout template, a service delivery template, or a simplified custom workflow.

### 12. What Data Should Be Mandatory On Each Project?

Confirm required fields such as:

- Site contact
- Client regional owner
- Landlord approval status
- Delivery partner contact
- Quote number
- Purchase order number
- Installation date
- Photo/signoff evidence
- Invoice or billing status

### 13. Should Voice Updates Be Used Operationally?

Voice updates can speed up admin work, but management should decide whether this should be part of the formal process or kept as an internal workspace convenience tool.

### 14. What Audit Trail Is Required?

The app records activity on project changes, but management should confirm whether a stricter audit trail is needed for compliance, billing, or dispute resolution. A unified Project Journal would make this stronger by recording every meaningful event in one searchable, exportable timeline.

## Suggested Next Phase

A practical next phase would be to run a small pilot with a limited set of real users and real projects.

Recommended pilot scope:

- 1 to 2 workspace administrators
- 1 client administrator
- 3 to 5 site contacts
- 1 delivery partner
- 10 to 20 active projects

During the pilot, test:

- Whether the project stages match the real workflow
- Whether client users understand the question/request flow
- Whether workspace administrators can keep project records updated without duplicate admin work
- Whether reports satisfy management needs
- Whether notifications are visible enough
- Whether delivery partners should have direct workflow update access
- Whether users prefer one chronological Project Journal over separate comments, tasks, files, and activity sections
- Which journal entry types and visibility rules are required for real operations

## Summary

RolloutHQ™ is intended to become the shared operational control room for the current PSG workspace and future enterprise project workspaces. It already covers the core workflows needed to manage projects, communicate updates, store files, track status, report progress, and notify client users when the workspace team responds to their project questions.

The most important product recommendation is to evolve the project detail record into a unified Project Journal. Instead of treating comments, questions, tasks, files, voice notes, and activity as separate modules, every significant project event should become a structured, searchable, permission-aware timeline entry.

The main decision now is not whether the app can support one rollout, but how the business wants the platform governed across workspaces: who updates what, who sees what, what counts as official communication, what belongs in the official journal, and what reporting management needs.