# Deployed at 08/19/2026 12:10:00

## Latest Deployment (Phase 2: Relational Task Schema)
- **Migration**: PostgreSQL schema with `project_tasks` relational table
- **Data Backfill**: Legacy JSONB tasks migrated to relational structure
- **Service Layer**: Complete refactor of portalService.ts for dual-path reads/writes
- **Task Operations**: CREATE, READ, UPDATE, DELETE all validated
- **Soft Delete**: Tasks marked with `deleted_at` timestamp instead of hard deletion
- **Backward Compatibility**: Service layer seamlessly bridges legacy and relational data
- **Status Mapping**: Frontend enum (open/busy/done/pending) ↔ Database enum (not_started/in_progress/complete/waiting/blocked)
- **Database Tests**: CRUD operations verified with production data

## Previous Deployment (08/17/2026 14:33:15)
- Task Pool System Implementation
- Optional task management with template pool
- Task status controls (complete, reopen, remove)
- Collapsible available tasks section
- Category-organized 20+ task templates
