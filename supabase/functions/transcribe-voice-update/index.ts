import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500);
  }

  if (!openAiApiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured for voice transcription.' }, 500);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Authentication is required.' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await userClient.auth.getUser();
  if (callerError || !callerData.user?.email) {
    return jsonResponse({ error: 'Your session could not be verified.' }, 401);
  }

  const callerEmail = callerData.user.email.toLowerCase();
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .or(`user_id.eq.${callerData.user.id},email.eq.${callerEmail}`)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  if (!allowedRoles.has(callerProfile?.role ?? '')) {
    return jsonResponse({ error: 'Only Colourpix administrators and PSG head office can transcribe voice updates.' }, 403);
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
    return jsonResponse({ error: downloadError?.message ?? 'Voice note could not be loaded.' }, 404);
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
    return jsonResponse({ error: transcriptionBody?.error?.message ?? 'Voice transcription failed.' }, transcriptionResponse.status);
  }

  const transcript = typeof transcriptionBody?.text === 'string' ? transcriptionBody.text.trim() : '';

  if (!transcript) {
    return jsonResponse({ error: 'No transcript was returned for this voice note.' }, 502);
  }

  return jsonResponse({ transcript });
});
