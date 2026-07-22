import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';

type NotifyProjectChangePayload = {
  to?: unknown;
  changeType?: unknown;
  actor?: unknown;
  message?: unknown;
  project?: unknown;
};

type ProjectSummary = {
  id: string;
  branch: string;
  town: string;
  province: string;
  currentStage: string;
  status: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const defaultRecipient = 'rollout@colourpix.co.za';
const validChangeTypes = new Set(['note', 'voice_note', 'voice_update']);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseProject(value: unknown): ProjectSummary {
  if (!value || typeof value !== 'object') {
    throw new Error('Project details are required.');
  }

  const project = value as Record<string, unknown>;
  const id = readString(project.id);
  const branch = readString(project.branch);

  if (!id || !branch) {
    throw new Error('Project ID and branch are required.');
  }

  return {
    id,
    branch,
    town: readString(project.town) || 'Not captured',
    province: readString(project.province) || 'Not captured',
    currentStage: readString(project.currentStage) || 'Not captured',
    status: readString(project.status) || 'Not captured',
  };
}

function parsePayload(payload: NotifyProjectChangePayload) {
  const actor = readString(payload.actor) || 'Workspace user';
  const message = readString(payload.message);
  const changeType = readString(payload.changeType) || 'note';
  const project = parseProject(payload.project);

  if (!validChangeTypes.has(changeType)) {
    throw new Error('A valid project change type is required.');
  }

  if (!message) {
    throw new Error('A notification message is required.');
  }

  return { actor, message, changeType, project };
}

function changeLabel(changeType: string) {
  if (changeType === 'voice_note') {
    return 'voice note';
  }

  if (changeType === 'voice_update') {
    return 'voice update';
  }

  return 'note';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Authentication is required.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase function environment is not configured.' }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: callerData, error: callerError } = await userClient.auth.getUser();
  if (callerError || !callerData.user?.email) {
    return jsonResponse({ error: 'Your session could not be verified.' }, 401);
  }

  let payload;
  try {
    payload = parsePayload(await request.json());
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Invalid request payload.' }, 400);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return jsonResponse({ error: 'RESEND_API_KEY is not configured for project change notifications.' }, 500);
  }

  const to = Deno.env.get('PROJECT_NOTIFICATION_TO') || defaultRecipient;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return jsonResponse({ error: 'PROJECT_NOTIFICATION_TO must be a valid email address.' }, 500);
  }

  const from = Deno.env.get('PROJECT_NOTIFICATION_FROM') || 'PSG Rebrand <rollout@colourpix.co.za>';
  const subject = `PSG Rebrand ${changeLabel(payload.changeType)}: ${payload.project.branch}`;
  const text = [
    `${payload.actor} left a ${changeLabel(payload.changeType)} on ${payload.project.branch}.`,
    '',
    `Project: ${payload.project.id}`,
    `Location: ${payload.project.town}, ${payload.project.province}`,
    `Stage: ${payload.project.currentStage}`,
    `Status: ${payload.project.status}`,
    '',
    payload.message,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonResponse({ error: body?.message ?? 'Project change notification email failed.' }, response.status);
  }

  return jsonResponse({ ok: true });
});