import { lazy } from 'react';

const CHUNK_RELOAD_PREFIX = 'psg:chunk-reload';

function getChunkReloadKey(importKey: string) {
  return `${CHUNK_RELOAD_PREFIX}:${importKey}`;
}

export function isRecoverableChunkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return [
    'failed to fetch dynamically imported module',
    'importing a module script failed',
    'dynamically imported module',
    'loading chunk',
    'chunkloaderror',
    'unable to preload css',
  ].some((snippet) => message.includes(snippet));
}

export function lazyWithChunkReload<T extends { default: React.ComponentType<any> }>(
  importKey: string,
  loader: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      const module = await loader();
      window.sessionStorage.removeItem(getChunkReloadKey(importKey));
      return module;
    } catch (error) {
      if (typeof window !== 'undefined' && isRecoverableChunkError(error)) {
        const reloadKey = getChunkReloadKey(importKey);
        const hasReloaded = window.sessionStorage.getItem(reloadKey) === 'true';

        if (!hasReloaded) {
          window.sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
          return new Promise<never>(() => {});
        }

        window.sessionStorage.removeItem(reloadKey);
      }

      throw error;
    }
  });
}

export function reloadOnVitePreloadError(event: Event) {
  const preloadEvent = event as Event & { payload?: unknown; preventDefault: () => void };

  if (!isRecoverableChunkError(preloadEvent.payload)) {
    return;
  }

  const reloadKey = `${CHUNK_RELOAD_PREFIX}:vite-preload`;
  const hasReloaded = window.sessionStorage.getItem(reloadKey) === 'true';

  if (hasReloaded) {
    window.sessionStorage.removeItem(reloadKey);
    return;
  }

  preloadEvent.preventDefault();
  window.sessionStorage.setItem(reloadKey, 'true');
  window.location.reload();
}