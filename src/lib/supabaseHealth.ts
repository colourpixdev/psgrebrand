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
    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const { error: queryError } = await supabase.from('projects').select('id').limit(1);

    if (queryError) {
      const isNetworkError = queryError.message.toLowerCase().includes('failed to fetch');
      return {
        ok: false,
        level: isNetworkError ? 'warning' : 'error',
        message: isNetworkError
          ? 'Supabase connection is temporarily unavailable. The app will retry automatically.'
          : `Supabase project is reachable, but the app query failed: ${queryError.message}. Check the live database schema and RLS policies.`,
      };
    }

    return {
      ok: true,
      level: 'ok',
      message: 'Supabase connected.',
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
