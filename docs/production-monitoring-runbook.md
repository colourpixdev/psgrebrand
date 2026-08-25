# Production Monitoring Runbook

This application has optional frontend telemetry and structured Supabase Edge Function logs. Monitoring must be configured in the production services; source code alone cannot create provider alerts.

## 1. Frontend errors

Create a Sentry project for the production workspace and add these deployment variables:

```text
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_APP_VERSION=<git-commit-or-release-version>
```

The app reports:

- React route render failures
- Browser and unhandled promise failures captured by Sentry
- Supabase network failures and HTTP 5xx responses
- Operation context, route, status, and request duration where available

Keep `sendDefaultPii` disabled. Do not add passwords, access tokens, file contents, or full request bodies to telemetry.

Recommended Sentry alerts:

- Any new production issue: notify the technical owner.
- More than 5 events in 10 minutes: page the technical owner.
- Regression in an existing issue after a deployment: notify immediately.

## 2. Supabase alerts

In the production Supabase project, review Logs and Observability for:

- Auth failures and invitation failures
- Postgres errors and slow queries
- RLS policy violations
- Storage upload/download errors
- Edge Function failures, duration, and invocation volume
- Database size, storage size, bandwidth, and connection usage

Create alerts through the Supabase alerting features available on the project plan, or forward logs to the organisation's logging platform. Search Edge Function logs by the `requestId` returned in the `x-request-id` response header.

Recommended thresholds:

- API or Edge Function 5xx rate above 5% for 10 minutes
- p95 Edge Function duration above 2 seconds for 10 minutes
- Two or more transcription or invitation failures in 10 minutes
- Database or Storage usage at 70%, 85%, and 95%
- Unexpected growth in RLS denied requests

## 3. Edge Function deployment

Deploy all three functions after verifying their secrets and production environment variables:

```bash
npx supabase functions deploy invite-user --project-ref <project-ref>
npx supabase functions deploy notify-project-change --project-ref <project-ref>
npx supabase functions deploy transcribe-voice-update --project-ref <project-ref>
```

Required secrets include:

- `SUPABASE_SERVICE_ROLE_KEY` for `invite-user` and `transcribe-voice-update`
- `RESEND_API_KEY` for `notify-project-change`
- `OPENAI_API_KEY` for `transcribe-voice-update`
- `SITE_URL` if invitation links need an explicit production callback URL

Never place these secrets in Vite variables or client-side code.

## 4. Uptime monitoring

Configure an external uptime check against the deployed app URL. Check:

- The application HTML returns 200.
- Static JavaScript assets load.
- The login route is reachable.
- A safe health query or authenticated synthetic check succeeds.

Alert after 5 minutes of failure and notify the production owner. Do not expose private project data through a public health endpoint.

## 5. Release smoke test

After every deployment:

1. Open the production app in a clean browser session.
2. Sign in with one test account for each supported role.
3. Verify dashboard loading and navigation.
4. Verify project and task read/write permissions.
5. Verify file upload and signed download access.
6. Verify invitations, notifications, and transcription when enabled.
7. Check Sentry for frontend errors and Supabase logs for 5xx/RLS errors.
8. Record the release identifier and result.

## 6. Incident response

For an alert:

1. Record the alert time, affected feature, release, and request ID.
2. Check Sentry, Edge Function logs, Postgres logs, Auth logs, and Storage logs.
3. Disable a faulty feature or user access if data exposure is suspected.
4. Roll back the frontend or function deployment when appropriate.
5. Restore from backup only after confirming the failure and recovery point.
6. Document the root cause and add a regression check before redeploying.

The TypeScript check (`npm run check`) validates the application build types. It does not replace browser smoke tests, RLS verification, or backup restore tests.
