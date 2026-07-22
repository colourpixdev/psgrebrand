# PSG Rebrand Access Control Audit

This document audits the current app functionality and explains which user roles can be assigned, what each role can do by default, and which capabilities Francois and Beverley can enable or disable per user from the restricted Access Controls page.

## Restricted Administration Page

- Page: `/access-controls`
- Visible only to: `francois@colourpix.co.za`, `bd@colourpix.co.za`, and `beverley@colourpix.co.za`
- Source of users: Supabase `profiles`
- Stored controls: `profiles.role` and `profiles.permission_overrides`
- Important note: role assignment is the default access model; per-user toggles are exceptions layered over the assigned role.

## Assignable Roles

| Role key | Display name | Intended users | Default scope |
| --- | --- | --- | --- |
| `colourpix_admin` | Workspace Administrator | Colourpix administrators | Full workspace operations, users, projects, files, reports, workflow, and settings |
| `psg_head_office` | Client Administrator | PSG head office users | All PSG workspace projects, approval-related workflow, reports, files, questions, and comments |
| `psg_branch_manager` | Site Contact | Branch managers and site contacts | Assigned branch/site projects, questions, file access, and reports |
| `sign_company` | Delivery Partner | Installers and delivery partners | Assigned installer projects, installation-stage workflow, files, comments, and tasks |

Every user must have exactly one assigned role. A user is never role-less; to remove a capability, keep the role and switch off the relevant capability override.

## App Functionality Surfaces

| Surface | Functionality | Access control source |
| --- | --- | --- |
| Dashboard | Project metrics, assigned tasks, responses, activity | Project visibility, task visibility, communication policy |
| Projects | Project list, create form, quick project lookup, project cards | Project access and create-project capability |
| Project detail | Project facts, text updates, timeline, questions, workflow, tasks, files | Project visibility plus communication, workflow, task, and file policies |
| Timeline | Tick/untick stage completion, assign timeline stages | All project viewers can tick/untick; assignment remains admin-controlled |
| Search | Search visible projects and open details | Project visibility |
| Reports | Workspace summaries, report filters, export/download actions | Report capabilities |
| Map | Project locations and status markers | Project visibility and map route access |
| Users | Invite/create users and view profiles | User-management capabilities |
| Access Controls | Assign roles and enable/disable per-user capabilities | Restricted email allow-list only |
| Settings | Auth/Supabase environment status | Settings capability |
| Profile | Personal avatar, title, company, and logo | Signed-in user profile access |
| Support | Operational support requests | Signed-in user access |
| About/Legal | Product, terms, data retention, and legal copy | Signed-in user access |
| Voice updates | Hidden for now | Route blocked and navigation removed |

## Enable/Disable Capability Groups

The Access Controls page exposes the following capability switches for each user.

### Project Access

| Capability | Effect |
| --- | --- |
| View assigned projects | User can see projects assigned by branch, workspace, or installer scope |
| View all projects | User can see every project in accessible workspaces |
| Create projects | User can create project records |
| Archive projects | User can archive project records when the feature is exposed |
| Delete projects | User can delete project records when the feature is exposed and backend policy allows it |
| Export project | User can export project-level data |
| Duplicate project | User can duplicate project setup when the feature is exposed |

### Workflow

| Capability | Effect |
| --- | --- |
| Change stage | User can change project stage from workflow controls |
| Change status | User can set status, including Busy, In progress, Awaiting approval, Delayed, On hold, Cancelled, and Completed |
| Change progress | User can change project progress percentage |
| Mark completed | User can move projects to Completed |
| Reopen completed projects | User can reopen completed projects |
| Change target dates | User can change target, delivery, or completion dates where exposed |

### Communication

| Capability | Effect |
| --- | --- |
| Create comments | User can add project journal text updates |
| Reply | User can reply in communication surfaces |
| Edit own comments | User can edit comments they created when exposed |
| Delete own comments | User can delete their own comments when exposed |
| Delete others comments | User can moderate comments from other users when exposed |
| Ask questions | User can open project questions or update requests |
| Answer questions | User can answer and resolve project questions |
| Close questions | User can close question threads when exposed |
| Mention users | User can mention other users where supported |
| Create internal notes | User can create internal operational notes and batch update inputs when exposed |

### Files

| Capability | Effect |
| --- | --- |
| Upload files | User can upload approved project documents or images |
| Download files | User can download project files |
| Delete files | User can delete project files when exposed |
| Replace files | User can replace existing project files when exposed |

### Tasks

| Capability | Effect |
| --- | --- |
| Create tasks | User can add project or timeline tasks |
| Assign tasks | User can assign work to other users |
| Complete tasks | User can tick or untick task and timeline completion |
| Delete tasks | User can delete project tasks |
| Reassign tasks | User can change task assignees |

### Reports

| Capability | Effect |
| --- | --- |
| View reports | User can open reports and summary views |
| Export reports | User can export report data |
| Create custom reports | User can define custom report outputs when exposed |
| Schedule reports | User can configure recurring reports when exposed |

### User Management

| Capability | Effect |
| --- | --- |
| Invite users | User can invite or create user profiles |
| Disable users | User can disable users when backend tools expose this action |
| Edit users | User can edit profile and access settings |
| Reset passwords | User can initiate password reset workflows when exposed |

### Notifications

| Capability | Effect |
| --- | --- |
| Receive email | User receives email notifications |
| Receive in-app | User receives in-app notifications when available |
| Receive SMS | User receives SMS notifications when configured |
| Receive WhatsApp | User receives WhatsApp notifications when configured |

## Role Defaults Summary

| Group | Workspace Administrator | Client Administrator | Site Contact | Delivery Partner |
| --- | --- | --- | --- | --- |
| Project access | Full access, create, archive, delete, export, duplicate | All projects, export only | Assigned projects, export only | Assigned projects, export only |
| Workflow | Full workflow control | Approval-stage workflow control | No direct workflow control by default | Installation-stage workflow control |
| Communication | Comments, questions, answers, moderation, internal notes | Comments, questions, mentions | Questions, replies, mentions | Comments, replies, mentions |
| Files | Upload, download, delete, replace | Upload and download | Upload and download | Upload and download |
| Tasks | Create, assign, complete, delete, reassign | Create and complete | No task control by default | Create and complete |
| Reports | View, export, custom, scheduled | View and export | View and export | No report access by default |
| User management | Invite, edit, disable, reset passwords | No user management | No user management | No user management |
| Notifications | Email and in-app | Email and in-app | Email and in-app | Email and in-app |

## Timeline Calculation

Timeline stages now use three practical states:

- Done: checked stage
- Busy: the current active unchecked stage
- Open: unchecked future stage

All users who can view a project can tick or untick timeline stages. When a stage is changed, the project recalculates:

- `currentStage`: first unchecked stage, or `Completed` when all stages are checked
- `status`: `completed` when all stages are checked, `awaiting_approval` when the busy stage is Awaiting Approval, otherwise `busy`
- `progress`: checked stage count divided by total timeline stages

This supports reversing work. For example, if Artwork Sent is unticked because artwork was sent back, that stage becomes the Busy stage and progress drops accordingly.

## Supabase Schema Notes

The restricted Access Controls page needs this profile column:

```sql
alter table public.profiles add column if not exists permission_overrides jsonb not null default '{}'::jsonb;
```

The Busy status requires the projects status check constraint to allow `busy`. The repository schema has been updated, but a live database with an existing check constraint may need a migration to drop and recreate that constraint.