# Access Controls, Roles, and Field Options for Bev Discussion

Last updated: 2026-07-23

## Purpose
This document summarizes:
- Current platform roles and what each role can do.
- Current seeded users and assigned roles.
- Candidate branch and project/product fields to keep, add, or remove.

## Current Roles

### 1) colourpix_admin
Intended owner/admin role with full operational access.

Key capabilities:
- Project access: view all, create, archive, delete, export, duplicate.
- Workflow: full control of stage/status/progress/dates; can complete/reopen.
- Communication: full comment and question moderation, internal notes.
- Files: upload/download/delete/replace.
- Tasks: create/assign/complete/delete/reassign.
- Reports: view/export/create custom/schedule.
- User management: invite/disable/edit/reset passwords.
- Notifications: email + in-app enabled by default.

### 2) psg_head_office
Broad visibility with limited control.

Key capabilities:
- Project access: view all, export; cannot create/archive/delete/duplicate.
- Workflow: can change stage/status/progress; cannot complete/reopen or change dates.
- Communication: can comment/reply/ask questions; no moderation controls.
- Files: upload/download; cannot delete/replace.
- Tasks: create/complete only.
- Reports: view/export only.
- User management: none.

### 3) psg_branch_manager
Branch-scoped operational visibility.

Key capabilities:
- Project access: assigned projects only; export allowed.
- Workflow: no workflow edit controls.
- Communication: reply + ask questions; no moderation controls.
- Files: upload/download; cannot delete/replace.
- Tasks: no create/assign/delete/reassign controls.
- Reports: view/export only.
- User management: none.

### 4) sign_company
Delivery partner execution role.

Key capabilities:
- Project access: assigned projects only; export allowed.
- Workflow: can change stage and progress; cannot change status/dates or complete/reopen.
- Communication: comment/reply; cannot manage questions.
- Files: upload/download; cannot delete/replace.
- Tasks: create/complete; cannot assign/delete/reassign.
- Reports: no report access.
- User management: none.

## Current Users + Assigned Roles
Source: scripts/seed-profiles.mjs

- Beverley: colourpix_admin
- Francois: colourpix_admin
- PSG Head Office: psg_head_office
- John Smith: psg_branch_manager (branch: PSG Hermanus)
- ABC Signage: sign_company

## Access Controls Page Coverage
Source: src/utils/permissions.ts (accessControlGroups)

Current toggle groups:
- Project Access
- Workflow
- Communication
- Files
- Tasks
- Reports
- User Management
- Notifications

Note:
- The UI currently supports boolean toggles from these groups.
- File type allow-lists and notification event-type arrays are currently policy-defined and not managed as per-user toggle arrays in this page.

## Branch Fields (Current)
Source: src/pages/BranchesPage.tsx

Current fields:
- name (required)
- division (required selection)
- province (required)
- town (required)
- physicalAddress (required)
- latitude (optional)
- longitude (optional)
- contactName (optional)
- contactEmail (optional)
- contactPhone (optional)

### Branch field discussion suggestions
Keep:
- name, division, province, town, physicalAddress
- latitude, longitude (important for map integrity)

Optional candidates to add:
- branchCode (short canonical code)
- region (for reporting rollups)
- isActive (instead of deleting old branches)
- openingHours
- supportEmail (separate from contact email)

Candidates to remove or de-emphasize:
- none recommended immediately; contact fields can remain optional.

## Project/Product Fields (Current)
Source: src/components/projects/ProjectCreateForm.tsx

Current fields:
- id (required)
- projectType (required)
- workspaceName (optional)
- clientCompany (optional)
- graphicsPartner (optional)
- branchId (required)
- branch (hidden/derived)
- province (optional, derived)
- town (optional, derived)
- physicalAddress (required, derived)
- manager (optional)
- managerEmail (optional)
- installer (optional)
- designer (optional)
- currentStage (required)
- status (required)
- targetDate (optional)
- installationDate (optional)
- completionDate (optional)
- progress (required 0-100)
- notes (optional)

### Project/product field discussion suggestions
Keep:
- id, projectType, branchId, currentStage, status, progress
- physicalAddress (map), manager/managerEmail, installer, designer
- targetDate/installationDate/completionDate

Optional candidates to add:
- priority (low/medium/high/critical)
- budgetEstimate
- actualCost
- riskLevel
- riskNotes
- slaDueDate
- externalReference (client PO/ticket)
- productFamily or productLine (if product reporting is needed)

Candidates to remove or auto-derive:
- manual entry for branch/province/town/physicalAddress where branch is already selected (prefer derive-only behavior)
- workspaceName/clientCompany/graphicsPartner if these become immutable workspace defaults

## Suggested Decisions to Take with Bev
1. Confirm whether branch managers should be allowed to create projects in their own branch scope.
2. Confirm whether sign company should be able to set project status, not only stage/progress.
3. Confirm whether report visibility should be enabled for sign company.
4. Confirm if deleting projects should remain admin-only or move to archive-only policy for safety.
5. Confirm which new governance fields are needed first: priority, region, active flags, external references.

## Implementation Notes (when approved)
- Role changes are defined in src/utils/permissions.ts via rolePolicies.
- Access Controls UI automatically renders configured boolean permission keys from accessControlGroups.
- Non-boolean policy fields (for example allowed file types) need explicit UI support if Bev wants them user-manageable.
