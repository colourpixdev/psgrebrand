# PSG Signage Rollout Portal

A secure, role-aware rollout management portal for tracking PSG signage projects from quotation through installation and completion.

## Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Supabase-ready data and auth layer

## Scripts

- `npm run dev`
- `npm run build`
- `npm run check`
- `npm run preview`

## Notes

This portal includes a Supabase-backed dashboard, project workflows, project detail pages, reports, search, map, and user profile management.

## Supabase Setup

Create a local `.env.local` file with these values, then run the SQL file in [supabase/schema.sql](supabase/schema.sql) inside the Supabase SQL editor:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

When both values are present, the app uses Supabase Auth and data APIs; otherwise it falls back to the built-in mock data flow.

For sign-in testing, create Supabase Auth users that match the seeded profile emails in [supabase/schema.sql](supabase/schema.sql) or your own users with the same role metadata shape used in [src/services/authService.ts](src/services/authService.ts).

## Repository

GitHub: https://github.com/francois2botha-star/rebrandreport
