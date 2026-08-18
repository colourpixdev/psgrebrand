# PSG Rebrand: Detailed Layout and Functionality Description

## 1. Application Overview

**PSG Rebrand** is a secure, role-aware workspace platform designed to manage the national PSG branch rebrand rollout. It serves as a single operational source of truth for all branch rebrand work, replacing scattered spreadsheets, emails, and WhatsApp messages with one shared project record for each of the 45+ PSG branches in South Africa and Namibia.

### Core Architecture
**1 Branch = 1 Rebrand Project**

This application operates on a simple, purposeful model:
- Each PSG branch location has exactly one associated rebrand project
- The rebrand project contains all work, files, communications, and progress tracking for that branch's rebrand
- No separate multi-project hierarchy is needed

### Current Workspace
- **Name:** PSG Branch Rebrand
- **Client:** PSG (Persistent Secure Global)
- **Service Partner:** Colourpix CC
- **Use Case:** National Signage Rollout and Rebrand across 45+ branches in South Africa and Namibia

### Core Purpose
The platform helps teams answer operational questions such as:
- How is each branch's rebrand progressing?
- Which rebrands are delayed, awaiting approval, or completed?
- Who is responsible for the next action at each branch?
- Which rebrands need client approval, design confirmation, or evidence?
- What is the complete audit trail of decisions and communication for each branch?

---

## 2. Technical Stack

- **Frontend:** React 19, Vite, TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router
- **State Management:** TanStack Query (React Query)
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Forms:** React Hook Form with Zod validation
- **Authentication:** Supabase Auth with role-based access control (RBAC)

---

## 3. Main Navigation Structure

The application uses a persistent sidebar navigation on the left with the following main sections:

### Primary Navigation Links
1. **Dashboard** - High-level overview of the national rollout and key metrics
2. **Branches** - Browse all 45+ branch locations and their rebrand status
3. **Map** - Geographic visualization of all branch rebrands
4. **Users** - Manage workspace users and roles
5. **Settings** - Workspace configuration and general settings

### Note on Terminology
- **Branch** refers to a physical PSG location (e.g., PSG Bultfontein Insure)
- **Branch Rebrand** or **Rebrand Project** refers to the work being performed at that branch
- These are 1:1 related — opening a branch's rebrand is opening its single associated project

---

## 4. Core Pages and Features

### 4.1 Dashboard Page - Rollout Overview
**Purpose:** High-level view of the national rebrand rollout status

**Key Features:**
- **Rollout Progress Summary**
  - Total branches: 45+
  - Completed: X
  - In progress: Y
  - Awaiting approval: Z
  - Delayed: N

- **Rollout Metrics**
  - Estimated completion date
  - Critical path items (blockers)
  - On-track vs. at-risk branches

- **Filter & View Options**
  - View by status
  - View by region/province
  - View by division
  - View by target date

- **Quick Access to Branches**
  - Sorted by urgency or status
  - Show rebrands requiring attention
  - Show recently updated rebrands

### 4.2 Branches Page
**Purpose:** View all 45+ branch locations and their rebrand status at a glance — the **National Rollout Control Centre**

**Key Sections:**

**A. Branch Cards Grid**
Each branch card displays:

```
┌────────────────────────────────────────────────────┐
│ PSG Bultfontein Insure          [INSURE]          │
│ Bultfontein, Free State                           │
│ Pres Swart Street, Bultfontein, 9670             │
│                                                    │
│ REBRAND STATUS                                    │
│ ● IN PROGRESS                                     │
│                                                    │
│ ████████████░░░░░░  57%                           │
│                                                    │
│ Target: 12 Sep 2026   Installation: 26 Sep 2026  │
│                                                    │
│ Contact: John Dlamini (Branch Manager)            │
│                                                    │
│              [OPEN REBRAND] [EDIT BRANCH]         │
└────────────────────────────────────────────────────┘
```

Each card shows:
- Branch name (prominent heading)
- Division badge (Wealth, Insure, Asset, Trust, etc.)
- Location (Town, Province)
- Physical address
- **Rebrand Status** (IN PROGRESS, COMPLETED, AWAITING APPROVAL, DELAYED, ON HOLD, CANCELLED)
- Progress bar (visual percentage complete)
- Key dates (Target Date, Installation Date)
- Primary contact person
- Two action buttons:
  - **[OPEN REBRAND]** - View the rebrand workspace (tasks, journal, files)
  - **[EDIT BRANCH]** - Edit branch information and contacts

**B. Search & Filter:**
- Search by branch name or location
- Filter by division (Wealth, Insure, Asset, etc.)
- Filter by province/region
- Filter by rebrand status (In Progress, Completed, Awaiting Approval, etc.)

**C. Rollout Summary**
- Total branches (45+)
- Completed rebrands
- In progress
- Awaiting approval
- Delayed

---

### 4.3 Branch Rebrand Page
**Purpose:** View and manage the rebrand project for a specific branch — this is the **rebrand workspace**

**Page Layout:**

#### A. Branch Header
```
← Back to Branches

PSG Bultfontein Insure
Bultfontein, Free State
Pres Swart Street, Bultfontein, 9670

┌──────────────────────────────────────────┐
│ BRANCH REBRAND                           │
│                                          │
│ STATUS                    PROGRESS       │
│ ● IN PROGRESS            57%             │
│                                          │
│ ████████████░░░░░░░░░░                   │
│                                          │
│ Target Date       Installation    Done   │
│ 12 Sep 2026       26 Sep 2026     —      │
└──────────────────────────────────────────┘
```

Displays:
- Back link to Branches
- Branch name and location details
- **BRANCH REBRAND** card showing:
  - Current status (IN PROGRESS, COMPLETED, AWAITING APPROVAL, etc.)
  - Visual progress bar and percentage
  - Key milestone dates

#### B. Section Navigation Tabs
```
OVERVIEW  |  TASKS  |  FILES  |  JOURNAL  |  DETAILS
```

Sections:
1. **OVERVIEW** - Quick status, next steps, assigned team members
2. **TASKS** - Task list, templates, status management
3. **FILES** - Uploaded documents, evidence, specifications
4. **JOURNAL** - Updates, questions, answers, activity log
5. **DETAILS** - Extended branch info, contacts, project notes

#### C. Overview Section
- Quick update form ("Fast entry")
- Key dates and status
- Assigned participants
- Outstanding tasks summary
- Recent activity snapshot

#### D. Tasks Section
**Available Tasks to Add**
- Expandable button showing 24 available task templates
- Organized by category: Planning, Design, Production, Installation, Signage, etc.
- Each template card shows:
  - Task name (e.g., "Kickoff Meeting", "Design Concept Review")
  - Description
  - Category badge
  - "+ Add task" button to instantly add to this rebrand

**Task List**
- Accordion-style expandable tasks
- Each task shows status, assignees, comments, attachments
- Status can be cycled: Pending → Open → Busy → Done
- Can add comments and attach files per task

#### E. Files Section
- Centralized file upload area (drag & drop)
- All rebrand project files listed
- Task-specific file attachments
- Preview, download, rename, delete options

#### F. Journal Section
- Chronological log of all updates, questions, answers, and activity
- Quick update composer
- Question/approval request form
- Activity log showing status changes and user actions

#### G. Details Section
- Extended branch information
- Branch contact persons (names, designations, emails, phones)
- Project notes
- Progress tracking
- Project creation date

### 4.4 Manage Rebrand Page (Detailed Editing)
**Purpose:** Comprehensive rebrand workflow and detailed project management

This is the detailed editing interface for managing a branch's rebrand project. It provides full control over tasks, workflow, communications, files, and documentation.

#### Section 1: Rebrand Summary
- Branch name and full location
- Current status (dropdown to change)
- Target date, Brief Requested date, Installation date, Completion date
- Physical address
- Progress percentage
- "Save summary fields" button

#### Section 2: Branch and Contact Persons
- Branch details (name, division, town/province, address)
- List of branch contact persons with:
  - Name
  - Designation (e.g., Manager, Contact Person)
  - Email
  - Phone number
- "View branch details" link

#### Section 3: Task Updates (Main Workspace)

**A. Task Input Section**
- Text input: "Add next action..." (disabled for PSG users)
- Multi-select dropdown: Assign task to users
- "Add" button to create new task

**B. Expand All / Collapse All Controls**
- Quick buttons to show/hide all task details at once

**C. Task List (Accordion-Style)**
Each task displays as a collapsible accordion with:

**Collapsed View:**
- Chevron indicator (▶ or ▼)
- Task text/name
- Status badge (Pending, Open, Busy, Done)
- Comment count
- File attachment count

**Expanded View:**
- Full task text
- Status button (clickable to cycle through: Pending → Open → Busy → Done)
- Assigned users with their designations
- "Move up" / "Move down" buttons for reordering tasks
- "Edit" button (for users with permission)
- "Delete" button (for users with permission)
- View/Hide updates toggle

**Attached Files Section** (within expanded task)
- List of files attached to this specific task
- Preview button (for images/PDFs)
- Download button
- Rename button
- Delete button

**Installation Request Section** (only for "Schedule Installation" task)
- Textarea for installation instructions
- "Save instructions" button

**Comments Section** (within expanded task)
- List of all task-linked comments/updates
- Each comment shows: date, author name, message content
- Comment input form:
  - Textarea: "Leave a comment for this task"
  - "Add comment" button
  - Note: "Comments appear in the project journal and under the task"

**D. Available Tasks to Add Section**
- Expandable button: "▶ Available tasks to add (24)"
- When expanded, shows grid of available task templates:
  - 24 templates organized by category
  - Each template card shows: name, description, category, "+ Add task" button
  - Clicking "+ Add task" immediately creates the template as a task in the rebrand
  - Templates include: Kickoff Meeting, Design Concept Review, Quality Check, Schedule Installation, etc.

#### Section 4: Journal (Communications)
**Purpose:** Unified communication and Q&A stream

**A. Conversation Composer**
- "Related task" dropdown: Select which task this relates to, or "General update"
- "Message" textarea: Write update or question
- "Save task update" button (if user can add updates)
- "Send request" button (if user can ask questions)
- Help text: "One composer, two actions: save an update or send a request"

**B. Follow-ups Section**
- Shows all outstanding questions/requests
- Each question shows:
  - Question status (Open, Answered, Unread)
  - Question text
  - Who asked it
  - Who answered (if answered)
  - When it was asked/answered
  - Answer content (if answered)
  - Reply button to add comment to question

**C. Activity Section**
- Chronological log of all project events
- Event types: Project Created, File Uploaded, Task Added, Status Changed, Comment Posted, Question Asked, Answer Posted, etc.
- Each entry shows: event type, timestamp, user who performed action, description

#### Section 5: Files Tab
**Purpose:** Centralized file management for the rebrand

**Key Features:**
- File upload area (drag & drop or click to select)
- Supported formats: PDF, DOCX, XLSX, JPG, PNG, DWG, AI (up to 25 MB)
- File list showing:
  - File name
  - Upload date/time
  - File size
  - Associated task (if any)
  - Preview button (for images/PDFs)
  - Download button
  - Rename button
  - Delete button (for admins)

#### Section 6: Notes Tab
**Purpose:** Rebrand project notes and ongoing documentation

**Key Features:**
- Large textarea for rebrand notes
- "Save notes" button
- Last note timestamp and editor name
- Rich formatting support (multi-line text)
- Notes visible to all project users

---

### 4.5 Map Page
**Purpose:** Geographic visualization of all branch rebrands

**Key Features:**
- Leaflet map integration showing South Africa and Namibia
- Markers for each branch with associated rebrands
- Marker clustering for dense areas
- Click marker to view branch details and rebrand status
- Map legend showing rebrand status colors
- Optional: Heat map visualization of rebrand activity by region
- Zoom and pan controls
- Search by location
- Filter by status or project type

---

### 4.6 Users Page
**Purpose:** User management and access control

**Key Sections:**

**A. User List**
- Table of all workspace users showing:
  - User name
  - Email
  - Role (Colourpix Admin, PSG Head Office, PSG Branch Manager, Sign Company, PSG User)
  - Status (Active, Invited, Inactive)
  - Actions (Edit, Remove)

**B. Add User Section**
- Email input field
- Role selector dropdown
- "Send invite" button
- Sends invitation email with workspace join link

**C. User Management**
- Edit user role
- Manage branch assignments (for branch managers)
- View last login timestamp
- Deactivate/remove user

---

### 4.7 Settings Page
**Purpose:** Workspace configuration and preferences

**Key Sections:**
- Workspace name and description
- Client company name
- Service partner (Colourpix CC)
- Logo uploads (client and service partner)
- Workspace status (Active, Planning, Archived)
- Email notifications settings
- Project template selection
- Access control rules
- API configuration (if applicable)

---

### 4.8 Access Controls Page
**Purpose:** Role-based permission management

**Key Features:**
- View matrix of roles and permissions
- Roles:
  - **Colourpix Admin:** Full workspace access, all features, user management
  - **PSG Head Office:** View all projects, approve designs, manage templates, generate reports
  - **PSG Branch Manager:** View only their assigned branch projects, update status, upload files
  - **Sign Company/Installer:** View assigned projects, upload delivery evidence, update task status
  - **PSG User:** Limited project view based on branch assignment

- Permissions tracked per role:
  - Can view all projects / only assigned
  - Can create/edit projects
  - Can delete projects
  - Can upload files
  - Can delete files
  - Can create tasks
  - Can complete tasks
  - Can reassign tasks
  - Can approve files
  - Can answer questions
  - Can delete tasks

---

### 4.9 Search Page
**Purpose:** Global project search and discovery

**Key Features:**
- Full-text search across:
  - Project names
  - Branch names
  - Comments and updates
  - Task names
  - File names
- Search filters:
  - By project status
  - By date range
  - By project type
  - By user/author
- Result types:
  - Projects
  - Comments/Updates
  - Tasks
  - Files
- Highlighted search terms in results
- Sort by relevance, date modified, or creation date

---

### 4.10 Reports Page
**Purpose:** Advanced reporting and analytics

**Report Types:**
1. **Single Branch Report**
   - Select a branch
   - Shows all projects for that branch
   - Summary metrics, timeline, outstanding items, and activity

2. **Multi-Branch Overview**
   - Shows projects across all branches
   - Comparison view
   - Regional performance metrics
   - Identifies blockers and delays

3. **Operational Blockers and Ownership**
   - Lists projects blocked by:
     - Awaiting approval
     - Missing information
     - Overdue tasks
   - Shows responsible person for each blocker
   - Sorted by urgency

**Report Format Options:**
- On-screen view (filtered, sortable table)
- Excel export (spreadsheet format with formulas)
- PDF export (formatted report with charts and images)

**Customization:**
- Date range selection
- Status filters
- Project type filters
- Search/keyword filters

---

### 4.11 Profile Page
**Purpose:** User profile and account management

**Key Features:**
- User name and email
- Role and designation
- Profile picture
- Profile title (e.g., "Branch Manager", "Designer")
- Branch assignments (for branch managers)
- Contact information
- Password change
- Email notification preferences
- Last login information

---

### 4.12 Support Page
**Purpose:** Help resources and support contact

**Key Sections:**
- FAQ section addressing common questions about:
  - Creating projects
  - Uploading files
  - Assigning tasks
  - Viewing reports
  - Accessing different sections
- Support contact form:
  - Subject line
  - Message body
  - Category selector (Bug, Feature Request, Question, Workflow, etc.)
  - File attachment for screenshots
  - "Send support request" button
- Knowledge base links
- Video tutorials (if available)
- Workspace administrator contact info

---

### 4.13 About Page
**Purpose:** Application information and credits

**Key Content:**
- Application name and version
- Platform description
- Copyright and licensing information
- Credits to Colourpix CC as service partner
- Technology stack information
- Links to PSG Rebrand documentation
- Link to GitHub repository

---

### 4.14 Legal Page
**Purpose:** Legal information and policies

**Key Documents:**
- Privacy Policy
- Terms of Service
- Data Protection (POPIA compliance for South Africa)
- Cookie Policy
- Acceptable Use Policy

---

## 5. User Roles and Permissions

### Role Hierarchy

#### 1. **Colourpix Admin**
- **Responsibilities:** Entire platform administration
- **Access:**
  - View all workspaces and all projects
  - Create and manage workspaces
  - Manage all users
  - Create and modify project templates
  - Configure workspace settings
  - Access access control configuration
  - View all reports
- **Restrictions:** None (full platform access)

#### 2. **PSG Head Office**
- **Responsibilities:** Client oversight and approval authority
- **Access:**
  - View all projects across all branches
  - Approve designs
  - Approve quotes and installations
  - Manage project templates
  - Generate reports and analytics
  - Manage workspace users
  - View all communications and questions
- **Restrictions:**
  - Cannot delete workspaces or projects (except with confirmation)
  - Cannot modify system settings
  - Cannot manage Colourpix admin accounts

#### 3. **PSG Branch Manager**
- **Responsibilities:** Manage projects for their specific branch
- **Access:**
  - View only their assigned branch projects
  - Update project status and task status
  - Upload files and evidence
  - Add tasks and comments
  - View task-related communications
  - Download reports for their branch
- **Restrictions:**
  - Cannot view projects from other branches
  - Cannot create new projects (only head office or admins)
  - Cannot delete projects
  - Cannot manage users
  - Cannot modify workspace settings

#### 4. **Sign Company / Installer**
- **Responsibilities:** Execute installation work and provide updates
- **Access:**
  - View only assigned projects
  - Update task status (mark complete)
  - Upload installation photos and evidence
  - Add task comments/updates
  - View project instructions and specifications
- **Restrictions:**
  - Cannot modify project structure
  - Cannot delete files
  - Cannot create new tasks
  - Cannot approve other work

#### 5. **PSG User** (Generic)
- **Responsibilities:** Limited project participation
- **Access:**
  - View assigned projects (role-based)
  - View publicly visible comments and updates
  - Add comments (if permitted)
  - View project files
- **Restrictions:**
  - Cannot create or delete tasks
  - Cannot approve work
  - Cannot access task updates section
  - Cannot upload files (usually)

---

## 6. Data Model and Project Structure

### Core Data Entities

#### Branch
```
{
  id: string
  code?: string
  name: string
  division: 'Wealth' | 'Insure' | 'Asset' | 'Trust' | 'Wealth Insure'
  province: string
  town: string
  physicalAddress: string
  latitude: number | null
  longitude: number | null
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  contacts?: ContactPerson[]
  createdAt: string
  updatedAt: string
}
```

#### Project
```
{
  id: string
  branchId: string
  branch: string (branch name)
  projectType: 'signage_rollout' | 'general_rollout' | 'service_delivery'
  projectTypeName: string
  siteLabel: string
  province: string
  town: string
  physicalAddress: string
  latitude: number | null
  longitude: number | null
  manager: string
  managerEmail: string
  designer: string
  currentStage: ProjectStage (free text)
  status: 'completed' | 'busy' | 'in_progress' | 'awaiting_approval' | 'delayed' | 'on_hold' | 'cancelled'
  targetDate: string
  briefRequestedDate: string
  installationDate: string
  completionDate: string
  progress: number (0-100%)
  notes: string
  files: ProjectFile[]
  tasks: TaskItem[]
  comments: CommentItem[]
  activity: ActivityItem[]
  updatedAt: string
}
```

#### Task
```
{
  id: string
  text: string (task description)
  completed: boolean
  status?: 'pending' | 'open' | 'busy' | 'done'
  stage?: ProjectStage
  assigneeName?: string
  assigneeEmail?: string
  assignees?: TaskAssignee[] (supports multiple assignees)
  installationRequest?: string
  createdAt?: string
  completedAt?: string
  completedByName?: string
  completedByEmail?: string
}
```

#### Task Assignee
```
{
  name: string
  email: string
  designation: string (e.g., "Branch Manager", "Designer")
}
```

#### Comment/Journal Entry
```
{
  id?: string
  taskId?: string (which task does this relate to, if any)
  kind?: 'comment' | 'question'
  date: string
  author: string
  message: string
  status?: 'open' | 'answered' (for questions)
  requesterEmail?: string
  requestedAt?: string
  answer?: string (for answered questions)
  answeredBy?: string
  answeredAt?: string
  unreadForRequester?: boolean
}
```

#### Project File
```
{
  name: string
  path?: string (storage path in Supabase)
  size?: number
  type?: string (MIME type)
  uploadedAt?: string
  taskId?: string (which task does this belong to)
}
```

#### Activity Entry
```
{
  type: string (e.g., 'project_created', 'file_uploaded', 'task_completed')
  timestamp: string
  user: string
  description: string
  relatedProjectId: string
  relatedTaskId?: string
  changes?: Record<string, any> (what changed)
}
```

---

## 7. User Workflows and Journeys

### Workflow 1: Managing a Branch Rebrand

**Step 1: Access the Rebrand**
1. User navigates to Branches page
2. Finds the branch they need to manage
3. Clicks [OPEN REBRAND] button
4. Navigates to Branch Rebrand page for that branch

**Step 2: Manage Rebrand Status**
1. On Branch Rebrand page, can view current status in header
2. Can update status, dates, and progress from Rebrand Summary section
3. Visual progress bar shows completion percentage

**Step 3: Work with Task Templates**
1. Click TASKS section
2. Find "Available tasks to add (24)" section
3. Browse available task templates by category:
   - Planning: Kickoff Meeting, Confirm Project Timeline, Stakeholder Alignment
   - Design: Submit Project Brief, Design Concept Review, Approve Final Design, Brand Guidelines Review
   - Production: Define Material Specifications, Production Start, Quality Check, Production Delivery
   - Installation: Schedule Installation, Installation Preparation, Installation, Post-Installation
   - Signage: Site Survey, Permit Requirements, Electrical Specifications
4. Click "+ Add task" on desired template
5. Template instantly becomes a task in the rebrand

**Step 4: Manage Task Workflow**
1. Tasks appear as accordion cards in task list
2. Click task to expand and see details
3. Assign users if needed
4. Click status button to progress: Pending → Open → Busy → Done
5. Add task-specific files and comments
6. Task appears as completed when marked Done

**Step 5: Upload Files & Evidence**
1. Click FILES section
2. Upload rebrand project files (PDF, DOCX, XLSX, JPG, PNG, DWG, AI)
3. Files upload to Supabase Storage
4. Can associate files with specific tasks
5. Can preview, download, rename, or delete files

**Step 6: Track Progress in Journal**
1. Click JOURNAL section
2. Add updates about rebrand progress
3. Ask questions or request approvals
4. View complete activity log of all changes
5. See answers to previous questions

**Step 7: Monitor Overall Progress**
1. Branch Rebrand header shows current status and progress
2. Task status overview shows how many tasks are Open, Busy, Done
3. Journal shows recent activity and outstanding items
4. Can drill into any task for detailed history

---

### Workflow 2: Branch Manager Site Updates

**Step 1: Access Branch Rebrand**
1. Branch Manager logs in, goes to Branches page
2. Finds their assigned branch
3. Clicks [OPEN REBRAND] button
4. Opens Branch Rebrand workspace

**Step 2: Quick Update from Site**
1. Goes to OVERVIEW section
2. Uses "Fast entry" quick update form
3. Types update message (e.g., "Site survey completed, awaiting approval")
4. Optionally links to specific task
5. Clicks "Save quick update"
6. Update immediately appears in Journal

**Step 3: Update Task Status**
1. Goes to TASKS section
2. Expands relevant task
3. Clicks status button to advance: Pending → Open → Busy → Done
4. Optionally adds comment explaining status change

**Step 4: Upload Site Evidence**
1. Takes photos of work in progress or completion
2. Goes to FILES section
3. Uploads photos to rebrand project
4. Links photos to relevant tasks if needed
5. Photos appear in Journal activity log

---

### Workflow 3: Requesting Approval or Information

**Step 1: Submit Question**
1. User navigates to Branch Rebrand workspace
2. Goes to JOURNAL section
3. Optionally selects related task from dropdown
4. Types question in message textarea (e.g., "Can we substitute the fascia material per cost concerns?")
5. Clicks "Send request" button
6. Question is marked as "Open" and added to journal

**Step 2: Notification**
1. Workspace admin is notified of new question
2. Question appears in project's outstanding items
3. Shows who asked, when, and what was asked

**Step 3: Admin Provides Answer**
1. Workspace admin navigates to Branch Rebrand
2. Finds question in JOURNAL section
3. Clicks reply/answer button
4. Types answer (e.g., "Yes, approved with supplier confirmation")
5. Clicks "Save answer"
6. Answer is linked to question
7. Question status changes to "Answered"
8. Requester is notified

**Step 4: Acknowledge Answer**
1. Requester navigates to Branch Rebrand
2. Goes to JOURNAL section
3. Sees answer to their question
4. Can mark as read or add follow-up comment

---

## 8. Key UI/UX Features

### Accordion-Based Task Management
- Tasks display as expandable/collapsible cards
- Closed view shows: task name, status, comment count, file count
- Expanded view shows: full task details, files, comments, edit/delete options
- "Expand All" / "Collapse All" buttons for batch operations
- Chevron indicators (▶/▼) show expand/collapse state

### Grid-Based Task Templates
- Available tasks display in responsive grid (1 column on mobile, 2 columns on tablet, 2+ on desktop)
- Each template card shows: name, description, category, add button
- Quick visual scan of available options
- Category badges for filtering

### Status Indicators
- Color-coded status badges:
  - Pending: Gray
  - Open: White/light background
  - Busy: Amber/yellow
  - Done: Green/emerald
- Status buttons are clickable to cycle through states
- Task status influences task visibility and sorting

### Responsive Design
- Mobile-first approach using Tailwind CSS
- Sidebar navigation collapses on mobile
- Grid layouts adapt to screen size
- Touch-friendly button sizes and spacing
- File inputs adapt to mobile file pickers

### Dark Theme with Brand Colors
- Dark background (slate-950, slate-900)
- Light text (slate-100, slate-200)
- Accent colors for interactive elements:
  - Cyan/Sky blue for primary actions
  - Emerald/green for success/add actions
  - Red for delete actions
  - Amber for warnings/busy status

### Keyboard Navigation
- Tab key navigation through inputs and buttons
- Enter to submit forms
- Escape to close dialogs/modals
- Arrow keys to navigate lists (optional enhancement)

### Real-time Updates
- Uses TanStack Query for efficient data fetching
- Automatic cache invalidation on mutations
- Optimistic updates for better perceived performance
- Automatic refresh of stale data

---

## 9. Simplified Data Architecture

### Core Model: 1 Branch = 1 Rebrand Project

The data structure reflects the single rebrand per branch:

```
Branch (physical location)
├── id
├── name
├── division
├── location (town, province)
├── address
├── contacts
└── rebrands: [Rebrand Project]
    └── Rebrand Project (1 active per branch)
        ├── status
        ├── progress
        ├── dates (target, installation, completion)
        ├── tasks[]
        ├── files[]
        ├── comments[]
        ├── activity[]
        └── notes
```

### Database Constraint
The system enforces: **A branch can have only one active rebrand project.**

This prevents:
- Accidental duplicate projects per branch
- Confusion about which project is current
- Unnecessary complexity in the UI

### Query Keys Structure
```
- ['branches']: All branches with rebrand status
- ['branch', branchId]: Specific branch with rebrand details
- ['rebrand', branchId]: Rebrand project for a branch
- ['portal-summary']: Dashboard rollout metrics
- ['users']: All workspace users
- ['search', query]: Search results across all rebrands
```

### Mutations Flow
1. **Add/Update/Delete Task:**
   - User action triggers mutation
   - Optimistic update shows immediately
   - Server processes change
   - Cache invalidated for ['project', projectId] and ['projects']
   - Success notification shown

2. **File Upload:**
   - File selected from input
   - Uploaded to Supabase Storage
   - File metadata saved to project.files array
   - Cache invalidated
   - Download via signed link

3. **Comment/Update:**
   - Posted to project.comments array
   - Added to activity log
   - Cache invalidated
   - Appears immediately in journal view

---

## 10. Future Enhancements and Roadmap

### Unified Project Journal
The roadmap recommends consolidating Comments, Questions, Files, Tasks, Voice Updates, and Activity into one chronological Project Journal with:
- Timestamped entries
- Different entry types (Comment, Question, File Upload, Task, Status Change, Photo, Decision, Approval)
- Visibility rules (Workspace admins only, Everyone on project, etc.)
- Threaded replies for questions and discussions
- Rich metadata for advanced filtering and reporting

### AI Features
- Project summary generation (AI-powered status overview)
- Voice note transcription (OpenAI integration)
- Meeting transcript processing to extract actions and deadlines
- Automated bottleneck detection
- Response time analytics

### Advanced Reporting
- Custom report builder
- Scheduled reports via email
- Dashboard widgets (customizable)
- Trend analysis (velocity, success rate by project type)
- Resource utilization reports

### Mobile App
- React Native or Flutter implementation
- Offline-first synchronization
- Push notifications
- Camera integration for photo evidence
- Voice note recording

### Integrations
- Slack notifications for project updates
- Email to project entry (forward emails to create journal entries)
- Google Calendar sync for installation dates
- Zapier integration for workflow automation
- Webhook support for third-party systems

### Additional Project Templates
- General rollout template
- Service delivery template
- Custom template builder

---

## 11. Technical Implementation Notes

### Authentication Flow
1. User visits login page
2. Enters email and password
3. Supabase Auth validates credentials
4. JWT token stored in browser
5. Token sent with each API request
6. AuthContext provides user object to all components
7. Routes protected based on user role

### File Handling
- Files stored in private Supabase Storage bucket
- Signed download links generated server-side (15-minute expiry)
- File metadata (name, size, MIME type) stored in PostgreSQL
- Preview modal opens for PDFs and images
- Direct browser download for other formats

### Role-Based Access Control (RBAC)
- User role stored in Supabase auth metadata
- Permissions checked on client (UI controls) and server (API)
- Components conditionally render based on user permissions
- Buttons and forms disabled for unauthorized users
- Server rejects unauthorized mutations

### Data Persistence
- PostgreSQL database in Supabase
- Automatic backups configured
- Row-level security (RLS) policies enforce access control
- Foreign key relationships maintain data integrity
- JSON columns for flexible nested data (tasks, files, comments)

---

## 12. Summary and Simplified User Journey

### The Simplified Experience

PSG Rebrand is a focused, role-aware workspace platform purpose-built for managing a national branch rebrand rollout. Its design prioritizes operational clarity and efficiency:

### User Journey

**Beverley (Head Office Manager)**

1. **Dashboard** → "How is the national rollout going?"
2. **Branches** → "Which branch needs attention?"
3. **Branch Rebrand** → "What is happening with this rebrand?"
4. **Tasks** → "What needs to happen next?"
5. **Journal** → "What has happened?"
6. **Files** → "Where is the evidence?"

### Architecture Benefits

**1 Branch = 1 Rebrand Project** model delivers:
- **Clarity:** No multi-project confusion within a branch
- **Focus:** Every branch has exactly one rebrand in progress
- **Simplicity:** Straightforward navigation and data flow
- **Scalability:** Works perfectly for 45+ branches
- **Consistency:** Standardized workflow across all locations

### Terminology

- **Branch** = Physical PSG location (PSG Bultfontein Insure)
- **Branch Rebrand** = The rebrand work at that location
- **Branch Rebrand Workspace** = The interface for managing that rebrand

No separate "Projects" list needed. Opening a branch opens its rebrand.

### Core Application Model

```
PSG REBRAND
├── Dashboard (national rollout status)
├── Branches (all 45+ branches)
│   └── Branch Rebrand (workspace for each branch)
│       ├── Summary (status, dates, progress)
│       ├── Tasks (workflow templates, status management)
│       ├── Files (documents, evidence, specs)
│       ├── Journal (updates, questions, activity)
│       └── Details (contacts, notes)
├── Map (geographic view of all rebrands)
├── Users (team management)
└── Settings (workspace config)
```

This is a **tighter, more purposeful application** than a generic multi-project platform. It's specifically designed for what you're building: a national rebrand rollout with clear workflow, transparent progress tracking, and centralized communications for 45+ branches.

The template-driven task system, combined with the 1:1 branch-to-rebrand model, ensures every branch follows a consistent process while remaining flexible enough to accommodate unique circumstances through tasks, files, and journal communications.
