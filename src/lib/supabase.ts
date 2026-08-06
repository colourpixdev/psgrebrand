import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __PSG_CONFIG__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_KEY?: string;
    };
  }
}

function getBuildEnv() {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const supabaseKey = supabasePublishableKey || supabaseAnonKey;

  return { supabaseUrl, supabaseKey };
}

function getRuntimeEnv() {
  if (typeof window === 'undefined') return { supabaseUrl: undefined, supabaseKey: undefined };
  const cfg = window.__PSG_CONFIG__ ?? (window as any).PSG_CONFIG ?? {};
  const supabaseUrl = cfg.VITE_SUPABASE_URL?.trim();
  const supabaseKey = cfg.VITE_SUPABASE_KEY?.trim();
  return { supabaseUrl, supabaseKey };
}

let runtimeConfig: { supabaseUrl?: string; supabaseKey?: string } | null = null;

export function setRuntimeSupabaseConfig(config: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_KEY?: string }) {
  runtimeConfig = {
    supabaseUrl: config.VITE_SUPABASE_URL?.trim(),
    supabaseKey: config.VITE_SUPABASE_KEY?.trim(),
  };
}

const buildEnv = getBuildEnv();
const runtimeEnv = getRuntimeEnv();
const effective = {
  supabaseUrl: (runtimeConfig as any)?.supabaseUrl ?? runtimeEnv.supabaseUrl ?? buildEnv.supabaseUrl,
  supabaseKey: (runtimeConfig as any)?.supabaseKey ?? runtimeEnv.supabaseKey ?? buildEnv.supabaseKey,
};

export const hasSupabaseConfig = Boolean(effective.supabaseUrl && effective.supabaseKey);

export const supabase =
  hasSupabaseConfig
    ? createClient(effective.supabaseUrl!, effective.supabaseKey!)
    : null;
