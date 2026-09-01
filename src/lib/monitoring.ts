import * as Sentry from '@sentry/react';

type MonitoringContext = Record<string, string | number | boolean | undefined>;

const sentryDsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const release = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim();
const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
const retryableErrorFragments = [
  'failed to fetch',
  'networkerror',
  'network error',
  'socket hang up',
  'connection reset',
  'timed out',
  'timeout',
  'temporarily unavailable',
  'econnreset',
  'aborted',
  'load failed',
];

Sentry.init({
  dsn: sentryDsn || undefined,
  enabled: Boolean(sentryDsn),
  release: release || undefined,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryFetch(error: unknown, response?: Response) {
  if (response && retryableStatusCodes.has(response.status)) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return retryableErrorFragments.some((fragment) => message.includes(fragment));
  }

  return false;
}

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
    const maxAttempts = 4;
    let lastError: unknown = undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        const durationMs = Math.round(performance.now() - startedAt);
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const pathname = new URL(url, window.location.origin).pathname;

        if (response.status >= 500 && attempt < maxAttempts - 1) {
          await sleep(250 * (attempt + 1));
          continue;
        }

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
        lastError = error;
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (attempt < maxAttempts - 1 && shouldRetryFetch(error)) {
          const delayMs = 250 * 2 ** attempt;
          await sleep(delayMs);
          continue;
        }

        reportError(error, {
          method: init?.method ?? 'GET',
          pathname: new URL(url, window.location.origin).pathname,
          durationMs: Math.round(performance.now() - startedAt),
        });
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw lastError;
  };
}
