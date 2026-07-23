# PSG Rebrand

Configurable project workspace platform for managed client delivery, rollout operations, requests, reports, and support workflows.

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
- `npm run website:preview`

## Notes

This platform includes a Supabase-backed dashboard, project workflows, project detail pages, reports, search, map, and user profile management.
Project files upload to a private Supabase Storage bucket and are downloaded through short-lived signed links.

The public marketing and sales site lives in [website](website). It is separate from the authenticated workspace app: the website handles business intake, project enquiries, workspace requests, demos, and customisation requests; the app remains the invitation-only workspace instance for active client work.

## Supabase Setup

Create a local `.env.local` file with these values, then run the SQL file in [supabase/schema.sql](supabase/schema.sql) inside the Supabase SQL editor:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_ENABLE_PREVIEW_AUTH=false
```

When both values are present, the app uses Supabase Auth and data APIs; otherwise it falls back to the built-in mock data flow.

Preview role sign-in is disabled by default for production safety. Enable it only for local testing by setting `VITE_ENABLE_PREVIEW_AUTH=true`.

For sign-in testing, create Supabase Auth users that match the seeded profile emails in [supabase/schema.sql](supabase/schema.sql) or your own users with the same role metadata shape used in [src/services/authService.ts](src/services/authService.ts).

The setup SQL also creates private Storage buckets:

- `project-files` accepts PDF, DOCX, XLSX, JPG, PNG, DWG, and AI files up to 25 MB and stores project file metadata in the `projects.files` JSON field.
- `voice-updates` accepts M4A, MP3, WAV, OGG, WebM, AAC, and MP4 audio up to 50 MB for admin/head-office voice note transcription.

### RLS hardening

[supabase/repair-live-database.sql](supabase/repair-live-database.sql) now provisions branch access, backfills the current project location columns, and scopes branch, project, profile, and project-file access by the signed-in user's profile role:

- Colourpix administrators and PSG head office can view all projects.
- PSG branch managers can view only their branch projects.
- Sign companies can view only projects assigned to their installer name or branch value.
- Profile writes are restricted to Colourpix administrators.
- Storage access is tied to projects the user can view.

To apply the hardened policies through the Supabase Management API, set `SUPABASE_ACCESS_TOKEN` locally with a Supabase Personal Access Token from the account tokens page. It should start with `sbp_`.

```bash
npm run apply:rls
npm run check:rls
```

Without a PAT, run [supabase/repair-live-database.sql](supabase/repair-live-database.sql) in the Supabase SQL Editor, then run `npm run check:rls` locally.

## Supabase Edge Functions

The user invite flow calls the `invite-user` Edge Function. Deploy it after logging into the Supabase CLI:

```bash
npx supabase login
npx supabase functions deploy invite-user --project-ref your-project-ref
```

[supabase/config.toml](supabase/config.toml) sets `verify_jwt = false` for this function so browser CORS preflight requests can reach the function. The function still verifies the caller session itself and only allows Colourpix administrators to send invites.

Voice note transcription calls the `transcribe-voice-update` Edge Function. It verifies the caller session, allows Colourpix administrators and PSG head office only, downloads the private audio object with the service role, and sends it to OpenAI transcription. Configure the secret before using audio uploads:

```bash
npx supabase secrets set OPENAI_API_KEY=your-openai-key --project-ref your-project-ref
npx supabase functions deploy transcribe-voice-update --project-ref your-project-ref
```

Optionally set `OPENAI_TRANSCRIPTION_MODEL`; otherwise the function uses `gpt-4o-mini-transcribe`.

## Repository

GitHub: https://github.com/francois2botha-star/rebrandreport
