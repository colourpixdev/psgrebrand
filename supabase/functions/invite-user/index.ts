import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';
import { getRequestId, logFunctionEvent } from '../_shared/monitoring.ts';

type Role = 'colourpix_admin' | 'psg_head_office' | 'psg_branch_manager' | 'sign_company';

type InvitePayload = {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  branch?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const validRoles: Role[] = ['colourpix_admin', 'psg_head_office', 'psg_branch_manager', 'sign_company'];

function jsonResponse(body: unknown, status = 200, requestId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
  });
}

function parsePayload(payload: InvitePayload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const role = typeof payload.role === 'string' && validRoles.includes(payload.role as Role) ? payload.role as Role : null;
  const branch = typeof payload.branch === 'string' && payload.branch.trim() ? payload.branch.trim() : null;

  if (name.length < 2) {
    throw new Error('Name is required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required.');
  }

  if (!role) {
    throw new Error('A valid role is required.');
  }

  return { name, email, role, branch };
}

Deno.serve(async (request) => {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  logFunctionEvent('invite-user', 'request_started', { requestId, method: request.method });

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    logFunctionEvent('invite-user', 'configuration_error', { requestId });
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500, requestId);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    logFunctionEvent('invite-user', 'authentication_failed', { requestId, reason: 'missing_authorization' });
    return jsonResponse({ error: 'Authentication is required.' }, 401, requestId);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await userClient.auth.getUser();
  if (callerError || !callerData.user?.email) {
    logFunctionEvent('invite-user', 'authentication_failed', { requestId, reason: 'invalid_session' });
    return jsonResponse({ error: 'Your session could not be verified.' }, 401, requestId);
  }

  const callerEmail = callerData.user.email.toLowerCase();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .or(`user_id.eq.${callerData.user.id},email.eq.${callerEmail}`)
    .maybeSingle();

  if (profileError) {
    logFunctionEvent('invite-user', 'database_error', { requestId, operation: 'load_caller_profile', error: profileError.message });
    return jsonResponse({ error: profileError.message }, 500, requestId);
  }

  if (callerProfile?.role !== 'colourpix_admin') {
    logFunctionEvent('invite-user', 'authorization_denied', { requestId, role: callerProfile?.role ?? 'unknown' });
    return jsonResponse({ error: 'Only Colourpix administrators can invite users.' }, 403, requestId);
  }

  let payload;
  try {
    payload = parsePayload(await request.json());
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Invalid request payload.' }, 400);
  }

  const redirectTo = Deno.env.get('SITE_URL') 
    ? `${Deno.env.get('SITE_URL')}/auth/callback`
    : undefined;
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
    data: {
      name: payload.name,
      role: payload.role,
      branch: payload.branch,
    },
    redirectTo,
  });

  if (inviteError) {
    logFunctionEvent('invite-user', 'auth_invite_failed', { requestId, error: inviteError.message });
    return jsonResponse({ error: inviteError.message }, 400, requestId);
  }

  const { data: profile, error: upsertError } = await adminClient
    .from('profiles')
    .upsert({
      user_id: inviteData.user?.id ?? null,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      branch: payload.branch,
    }, { onConflict: 'email' })
    .select('name, role, branch, email')
    .single();

  if (upsertError) {
    logFunctionEvent('invite-user', 'database_error', { requestId, operation: 'upsert_profile', error: upsertError.message });
    return jsonResponse({ error: upsertError.message }, 400, requestId);
  }

  logFunctionEvent('invite-user', 'request_completed', { requestId, status: 200, durationMs: Date.now() - startedAt });
  return jsonResponse({
    name: profile.name,
    role: profile.role,
    branch: profile.branch ?? undefined,
    email: profile.email,
  }, 200, requestId);
});