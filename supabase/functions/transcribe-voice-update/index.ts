import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';
import { getRequestId, logFunctionEvent } from '../_shared/monitoring.ts';

type TranscribePayload = {
  path?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedRoles = new Set(['colourpix_admin', 'psg_head_office']);
const voiceUpdatesBucket = 'voice-updates';

function jsonResponse(body: unknown, status = 200, requestId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
  });
}

function parsePayload(payload: TranscribePayload) {
  const path = typeof payload.path === 'string' ? payload.path.trim() : '';

  if (!path || path.includes('..') || path.startsWith('/')) {
    throw new Error('A valid voice note path is required.');
  }

  return { path };
}

function fileNameFromPath(path: string) {
  return path.split('/').pop() || 'voice-note.webm';
}

Deno.serve(async (request) => {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  logFunctionEvent('transcribe-voice-update', 'request_started', { requestId, method: request.method });

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
  const transcriptionModel = Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') || 'gpt-4o-mini-transcribe';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    logFunctionEvent('transcribe-voice-update', 'configuration_error', { requestId, missing: 'supabase' });
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500, requestId);
  }

  if (!openAiApiKey) {
    logFunctionEvent('transcribe-voice-update', 'configuration_error', { requestId, missing: 'openai' });
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured for voice transcription.' }, 500, requestId);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    logFunctionEvent('transcribe-voice-update', 'authentication_failed', { requestId, reason: 'missing_authorization' });
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
    logFunctionEvent('transcribe-voice-update', 'authentication_failed', { requestId, reason: 'invalid_session' });
    return jsonResponse({ error: 'Your session could not be verified.' }, 401, requestId);
  }

  const callerEmail = callerData.user.email.toLowerCase();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .or(`user_id.eq.${callerData.user.id},email.eq.${callerEmail}`)
    .maybeSingle();

  if (profileError) {
    logFunctionEvent('transcribe-voice-update', 'database_error', { requestId, operation: 'load_caller_profile', error: profileError.message });
    return jsonResponse({ error: profileError.message }, 500, requestId);
  }

  if (!allowedRoles.has(callerProfile?.role ?? '')) {
    logFunctionEvent('transcribe-voice-update', 'authorization_denied', { requestId, role: callerProfile?.role ?? 'unknown' });
    return jsonResponse({ error: 'Only Colourpix administrators and PSG head office can transcribe voice updates.' }, 403, requestId);
  }

  let payload;
  try {
    payload = parsePayload(await request.json());
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Invalid request payload.' }, 400);
  }

  const { data: audioFile, error: downloadError } = await adminClient.storage
    .from(voiceUpdatesBucket)
    .download(payload.path);

  if (downloadError || !audioFile) {
    logFunctionEvent('transcribe-voice-update', 'storage_download_failed', { requestId, error: downloadError?.message ?? 'missing_file' });
    return jsonResponse({ error: downloadError?.message ?? 'Voice note could not be loaded.' }, 404, requestId);
  }

  const formData = new FormData();
  formData.append('model', transcriptionModel);
  formData.append('response_format', 'json');
  formData.append('file', audioFile, fileNameFromPath(payload.path));

  const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: formData,
  });

  const transcriptionBody = await transcriptionResponse.json().catch(() => null);

  if (!transcriptionResponse.ok) {
    logFunctionEvent('transcribe-voice-update', 'openai_request_failed', { requestId, status: transcriptionResponse.status, durationMs: Date.now() - startedAt });
    return jsonResponse({ error: transcriptionBody?.error?.message ?? 'Voice transcription failed.' }, transcriptionResponse.status, requestId);
  }

  const transcript = typeof transcriptionBody?.text === 'string' ? transcriptionBody.text.trim() : '';

  if (!transcript) {
    logFunctionEvent('transcribe-voice-update', 'empty_transcript', { requestId, durationMs: Date.now() - startedAt });
    return jsonResponse({ error: 'No transcript was returned for this voice note.' }, 502, requestId);
  }

  logFunctionEvent('transcribe-voice-update', 'request_completed', { requestId, status: 200, durationMs: Date.now() - startedAt });
  return jsonResponse({ transcript }, 200, requestId);
});
