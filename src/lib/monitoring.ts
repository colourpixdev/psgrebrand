import * as Sentry from '@sentry/react';

type MonitoringContext = Record<string, string | number | boolean | undefined>;

const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const release = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim();

Sentry.init({
  dsn: sentryDsn || undefined,
  enabled: Boolean(sentryDsn),
  release: release || undefined,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

export function reportError(error: unknown, context?: MonitoringContext) {
  if (!sentryDsn) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('operation', context);
    }
    Sentry.captureException(error);
  });
}

export function reportMessage(message: string, context?: MonitoringContext) {
  if (!sentryDsn) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('operation', context);
    }
    Sentry.captureMessage(message, 'warning');
  });
}

export function addBreadcrumb(message: string, context?: MonitoringContext) {
  if (!sentryDsn) return;

  Sentry.addBreadcrumb({
    message,
    data: context,
    level: 'info',
  });
}

export function getMonitoringFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();

    try {
      const response = await fetch(input, init);
      const durationMs = Math.round(performance.now() - startedAt);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(url, window.location.origin).pathname;

      if (response.status >= 500) {
        reportMessage('Supabase request failed', {
          method: init?.method ?? 'GET',
          pathname,
          status: response.status,
          durationMs,
        });
      } else if (response.status === 401 || response.status === 403) {
        addBreadcrumb('Supabase request denied', {
          method: init?.method ?? 'GET',
          pathname,
          status: response.status,
          durationMs,
        });
      }

      return response;
    } catch (error) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      reportError(error, {
        method: init?.method ?? 'GET',
        pathname: new URL(url, window.location.origin).pathname,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  };
}
