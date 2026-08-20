# Checkpoint A

Date: 2026-08-20

Purpose: Record the low-risk duplicate-information cleanup so it can be reverted as one deployment commit if needed.

Changes in this checkpoint:

- Dashboard: removed the internal-only `Recent activity` panel because it repeated the same project stream already presented in `My attention`. The external-user `Relevant branches` panel remains.
- Project detail: renamed the lower `Branch reference` section to `Project details`.
- Project detail: removed the repeated branch name heading from the lower section.
- Project detail: removed the repeated town/province line from the lower section.
- Project detail: removed the repeated physical-address line from the lower section. Branch identity, contacts, and address remain in the top branch panel.
- Project detail: kept the distinct project manager, stage, status, brief-requested date, installation date, completion date, and edit/save workflow.

Not changed:

- Branch and contact editing.
- Stage checklist and stage actions.
- Project history and latest update.
- Files, comments, questions, reports, and role restrictions.

Validation: `npm run check` passed.

Revert point: the deployment commit created for this checkpoint is the commit immediately following this file's addition. Reverting that single commit restores the pre-Checkpoint-A presentation and removes this record from the deployed app.
