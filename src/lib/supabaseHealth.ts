import { supabase } from './supabase';

export type SupabaseHealth = {
  ok: boolean;
  message: string;
  level: 'ok' | 'warning' | 'error';
};

export async function checkSupabaseReachability(): Promise<SupabaseHealth> {
  if (!supabase) {
    return {
      ok: false,
      level: 'warning',
      message: 'Supabase is not configured. Add your project URL and publishable key before deploying the live workspace.',
    };
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const { count, error } = await supabase.from('projects').select('id', { count: 'exact', head: true });

    if (error) {
      return {
        ok: false,
        level: 'error',
        message: `Supabase project is reachable, but the app query failed: ${error.message}. Check the live database schema and RLS policies.`,
      };
    }

    return {
      ok: true,
      level: 'ok',
      message: `Supabase connected. Live projects available: ${count ?? 0}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    return {
      ok: false,
      level: 'error',
      message: `Supabase is unreachable from this deployment. Check the live environment variables and confirm the Supabase project is online. ${message}`,
    };
  }
}
