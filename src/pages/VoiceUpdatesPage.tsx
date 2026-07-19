import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Mic2, Wand2 } from 'lucide-react';
import { applyProjectVoiceUpdate, getProjects, transcribeVoiceUpdateAudio, uploadVoiceUpdateAudio } from '../services/portalService';
import { timelineStages } from '../constants/portal';
import { useAuth } from '../contexts/AuthContext';
import type { Project, ProjectStage, ProjectStatus } from '../types/domain';

type AppliedProject = Pick<Project, 'id' | 'branch' | 'currentStage' | 'status'>;

type ManualVoiceUpdateForm = {
  projectId: string;
  currentStage: '' | ProjectStage;
  status: '' | ProjectStatus;
  installationDate: string;
  targetDate: string;
  comment: string;
  tasks: string;
};

type VoiceSuggestion = {
  id: string;
  projectId: string;
  branch: string;
  excerpt: string;
  confidence: number;
  selected: boolean;
  currentStage?: ProjectStage;
  status?: ProjectStatus;
  progress?: number;
  installationDate?: string;
  targetDate?: string;
  comment: string;
  tasks: string;
};

type ReviewState = 'idle' | 'matches' | 'no_matches' | 'manual_added' | 'applying' | 'applied' | 'error';

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const statusOptions: ProjectStatus[] = ['in_progress', 'awaiting_approval', 'delayed', 'on_hold', 'cancelled', 'completed'];
const genericProjectWords = new Set(['psg', 'branch', 'office', 'wealth', 'insure', 'signage', 'project', 'site', 'location', 'rollout', 'service']);
const voicePromptChips = [
  'Say the site or project ID first',
  'Mention the new stage',
  'Add install or target dates',
  'Say what is blocking progress',
  'End with follow-up tasks',
];
const sampleVoiceUpdate = 'Hermanus project is now in production. The delivery partner confirmed installation for 15 August. Please follow up the outstanding approval.';

function progressForStage(stage: ProjectStage) {
  const index = timelineStages.indexOf(stage);
  if (index < 0) {
    return stage === 'Completed' ? 100 : 0;
  }

  return Math.round((index / (timelineStages.length - 1)) * 100);
}

function statusForStage(stage: ProjectStage, fallback: ProjectStatus): ProjectStatus {
  if (stage === 'Completed') {
    return 'completed';
  }

  if (stage === 'Awaiting Approval') {
    return 'awaiting_approval';
  }

  return fallback === 'completed' || fallback === 'cancelled' ? 'in_progress' : fallback;
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function splitTranscript(transcript: string) {
  return transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function projectAliases(project: Project) {
  const aliases = new Set([
    project.branch,
    project.id,
    project.town,
    project.branch.replace(/^PSG\s+/i, ''),
  ]);

  return [...aliases]
    .map(normalise)
    .filter((alias) => alias.length > 2);
}

function matchConfidence(segment: string, project: Project) {
  const text = normalise(segment);
  const aliases = projectAliases(project);

  if (aliases.some((alias) => alias.length > 6 && text.includes(alias))) {
    return 0.92;
  }

  const branchWords = normalise(project.branch).split(' ').filter((word) => word.length > 3 && !genericProjectWords.has(word));
  const matchedWords = branchWords.filter((word) => text.includes(word)).length;
  if (branchWords.length > 1 && matchedWords >= Math.min(2, branchWords.length)) {
    return 0.76;
  }

  return 0;
}

function inferStage(segment: string): ProjectStage | undefined {
  const text = normalise(segment);
  const directStage = timelineStages.find((stage) => text.includes(normalise(stage)));
  if (directStage) {
    return directStage;
  }

  if (/client sign ?off|sign ?off/.test(text)) {
    return 'Client Signoff';
  }

  if (/photo|photos uploaded/.test(text)) {
    return 'Photos Uploaded';
  }

  if (/installing|installation in progress/.test(text)) {
    return 'Installation In Progress';
  }

  if (/install(ed|ation complete)|completed|done/.test(text)) {
    return 'Completed';
  }

  if (/install(ation)? scheduled|booked/.test(text)) {
    return 'Installation Scheduled';
  }

  if (/production|manufacturing/.test(text)) {
    return 'Production';
  }

  if (/po issued|purchase order issued/.test(text)) {
    return 'PO Issued';
  }

  if (/quotation received|quote came in|quote received/.test(text)) {
    return 'Quotation Received';
  }

  if (/quotation requested|quote requested/.test(text)) {
    return 'Quotation Requested';
  }

  if (/approved/.test(text)) {
    return 'Approved';
  }

  if (/approval|waiting for approval|awaiting approval/.test(text)) {
    return 'Awaiting Approval';
  }

  if (/artwork sent/.test(text)) {
    return 'Artwork Sent';
  }

  if (/artwork/.test(text)) {
    return 'Artwork In Progress';
  }

  if (/measurement|dimensions/.test(text)) {
    return 'Measurements Received';
  }

  if (/site survey|survey/.test(text)) {
    return 'Site Survey';
  }

  return undefined;
}

function inferStatus(segment: string, stage: ProjectStage | undefined, currentStatus: ProjectStatus): ProjectStatus | undefined {
  const text = normalise(segment);

  if (/cancelled|canceled/.test(text)) {
    return 'cancelled';
  }

  if (/on hold|paused/.test(text)) {
    return 'on_hold';
  }

  if (/delay|delayed|stuck|waiting on|waiting for/.test(text)) {
    return 'delayed';
  }

  if (stage) {
    return statusForStage(stage, currentStatus);
  }

  return undefined;
}

function extractDate(segment: string) {
  return segment.match(/\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\b/i)?.[0]
    ?? segment.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
    ?? segment.match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/)?.[0];
}

function extractTasks(segment: string) {
  const text = segment.trim();
  const tasks = new Set<string>();
  const cleanTaskSubject = (value: string | undefined) => value?.split(/\s+and\s+|,|;/i)[0]?.trim();
  const followUp = cleanTaskSubject(text.match(/follow up(?: on)?\s+([^.!?]+)/i)?.[1]);
  const waiting = cleanTaskSubject(text.match(/waiting (?:on|for)\s+([^.!?]+)/i)?.[1]);
  const needs = cleanTaskSubject(text.match(/needs? to\s+([^.!?]+)/i)?.[1]);

  if (followUp) {
    tasks.add(`Follow up ${followUp}`);
  }

  if (waiting) {
    tasks.add(`Follow up ${waiting}`);
  }

  if (needs) {
    tasks.add(needs.charAt(0).toUpperCase() + needs.slice(1));
  }

  if (/po .*outstanding|outstanding .*po/i.test(text)) {
    tasks.add('Follow up outstanding PO');
  }

  return [...tasks].slice(0, 3);
}

function matchProjects(projects: Project[], transcript: string): VoiceSuggestion[] {
  const segments = splitTranscript(transcript);
  const suggestions: VoiceSuggestion[] = [];

  for (const project of projects) {
    const matches = segments
      .map((segment, index) => ({ segment, index, confidence: matchConfidence(segment, project) }))
      .filter((match) => match.confidence > 0)
      .sort((left, right) => right.confidence - left.confidence);
    const matchedSegment = matches[0]?.segment;
    const matchedIndex = matches[0]?.index;

    if (!matchedSegment || matchedIndex === undefined) {
      continue;
    }

    const excerptSegments = [matchedSegment];
    for (const nextSegment of segments.slice(matchedIndex + 1)) {
      const startsAnotherProject = projects.some((candidate) => candidate.id !== project.id && matchConfidence(nextSegment, candidate) > 0);
      if (startsAnotherProject) {
        break;
      }

      excerptSegments.push(nextSegment);
    }

    const excerpt = excerptSegments.join(' ');
    const currentStage = inferStage(excerpt);
    const status = inferStatus(excerpt, currentStage, project.status);
    const date = extractDate(excerpt);
    const tasks = extractTasks(excerpt);
    const confidence = matches[0].confidence;

    suggestions.push({
      id: `${project.id}-${suggestions.length}`,
      projectId: project.id,
      branch: project.branch,
      excerpt,
      confidence,
      selected: confidence >= 0.75,
      currentStage,
      status,
      progress: currentStage ? progressForStage(currentStage) : undefined,
      installationDate: /install/i.test(excerpt) ? date : undefined,
      targetDate: /target|deadline|due/i.test(excerpt) ? date : undefined,
      comment: excerpt,
      tasks: tasks.join('\n'),
    });
  }

  return suggestions.sort((left, right) => right.confidence - left.confidence);
}

export function VoiceUpdatesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const transcriptRef = useRef('');
  const transcriptInputRef = useRef<HTMLTextAreaElement>(null);
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[]>([]);
  const [manualForm, setManualForm] = useState<ManualVoiceUpdateForm>({
    projectId: '',
    currentStage: '',
    status: '',
    installationDate: '',
    targetDate: '',
    comment: '',
    tasks: '',
  });
  const [appliedProjects, setAppliedProjects] = useState<AppliedProject[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('idle');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects });
  function getCurrentTranscript() {
    return transcriptInputRef.current?.value ?? transcriptRef.current;
  }

  function reviewTranscript(nextTranscript = getCurrentTranscript()) {
    if (projects.length === 0) {
      setNotice('Projects are still loading. Try reviewing the transcript again in a moment.');
      return;
    }

    if (!nextTranscript.trim()) {
      setNotice('Add transcript text or use the structured update form before sending to the review queue.');
      return;
    }

    const matches = matchProjects(projects, nextTranscript);
    setSuggestions(matches);
    setAppliedProjects([]);
    setReviewState(matches.length > 0 ? 'matches' : 'no_matches');
    setNotice(matches.length > 0 ? `${matches.length} project update${matches.length === 1 ? '' : 's'} ready to review.` : 'No confident project matches found. Select the project below and add the update to the review queue.');
  }

  const transcribeMutation = useMutation({
    onMutate: () => {
      setReviewState('idle');
      setNotice('Transcribing voice note. Keep this page open until the transcript appears.');
    },
    mutationFn: async (file: File) => {
      const upload = await uploadVoiceUpdateAudio(file);
      return transcribeVoiceUpdateAudio(upload.path);
    },
    onSuccess: (nextTranscript) => {
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
      if (projects.length > 0) {
        reviewTranscript(nextTranscript);
      } else {
        setSuggestions([]);
        setAppliedProjects([]);
        setReviewState('idle');
        setNotice('Voice note transcribed. Projects are still loading; select Review transcript in a moment.');
      }
    },
    onError: (error) => {
      setReviewState('error');
      setNotice(error instanceof Error ? error.message : 'Voice note transcription failed. Paste the transcript or try another file.');
    },
  });
  const applyMutation = useMutation({
    onMutate: () => {
      setReviewState('applying');
      setNotice(`Applying ${selectedSuggestions.length} selected voice update${selectedSuggestions.length === 1 ? '' : 's'}...`);
    },
    mutationFn: async (approved: VoiceSuggestion[]) => {
      const updatedProjects: AppliedProject[] = [];

      for (const suggestion of approved) {
        const updatedProject = await applyProjectVoiceUpdate({
          projectId: suggestion.projectId,
          actor: user?.name ?? 'Workspace user',
          currentStage: suggestion.currentStage,
          status: suggestion.status,
          progress: suggestion.progress,
          targetDate: suggestion.targetDate,
          installationDate: suggestion.installationDate,
          comment: suggestion.comment,
          tasks: suggestion.tasks.split('\n').map((task) => task.trim()).filter(Boolean),
        });
        updatedProjects.push({
          id: updatedProject.id,
          branch: updatedProject.branch,
          currentStage: updatedProject.currentStage,
          status: updatedProject.status,
        });
      }

      return updatedProjects;
    },
    onSuccess: async (updatedProjects) => {
      setNotice(`${updatedProjects.length} voice update${updatedProjects.length === 1 ? '' : 's'} applied. Open the project link below to confirm the change.`);
      setSuggestions([]);
      setAppliedProjects(updatedProjects);
      setReviewState('applied');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
      ]);
    },
    onError: (error) => {
      setReviewState('error');
      setNotice(error instanceof Error ? error.message : 'Unable to apply the selected voice updates. Review the queue and try again.');
    },
  });

  function updateSuggestion(id: string, patch: Partial<VoiceSuggestion>) {
    setSuggestions((current) => current.map((suggestion) => (suggestion.id === id ? { ...suggestion, ...patch } : suggestion)));
  }

  function updateManualForm(patch: Partial<ManualVoiceUpdateForm>) {
    setManualForm((current) => ({ ...current, ...patch }));
  }

  function addManualUpdateToReviewQueue() {
    const project = projects.find((candidate) => candidate.id === manualForm.projectId);
    if (!project) {
      setNotice('Select a project before adding the update to the review queue.');
      return;
    }

    const comment = manualForm.comment.trim() || getCurrentTranscript().trim();
    const tasks = manualForm.tasks.trim();
    const hasStructuredChange = Boolean(manualForm.currentStage || manualForm.status || manualForm.installationDate.trim() || manualForm.targetDate.trim() || comment || tasks);
    if (!hasStructuredChange) {
      setNotice('Add at least one update field before sending it to the review queue.');
      return;
    }

    const status = manualForm.currentStage ? statusForStage(manualForm.currentStage, manualForm.status || project.status) : manualForm.status || undefined;
    const suggestion: VoiceSuggestion = {
      id: `manual-${project.id}-${Date.now()}`,
      projectId: project.id,
      branch: project.branch,
      excerpt: comment || `${project.branch} manual update`,
      confidence: 1,
      selected: true,
      currentStage: manualForm.currentStage || undefined,
      status,
      progress: manualForm.currentStage ? progressForStage(manualForm.currentStage) : undefined,
      installationDate: manualForm.installationDate.trim() || undefined,
      targetDate: manualForm.targetDate.trim() || undefined,
      comment,
      tasks,
    };

    setSuggestions((current) => [suggestion, ...current]);
    setAppliedProjects([]);
    setManualForm({
      projectId: '',
      currentStage: '',
      status: '',
      installationDate: '',
      targetDate: '',
      comment: '',
      tasks: '',
    });
    setReviewState('manual_added');
    setNotice('Structured project update added to the review queue.');
  }

  function updateTranscript(nextTranscript: string) {
    transcriptRef.current = nextTranscript;
    setTranscript(nextTranscript);
    setSuggestions([]);
    setAppliedProjects([]);
    setReviewState('idle');
    setNotice(null);
    transcribeMutation.reset();
    applyMutation.reset();
  }

  function startDictation() {
    const Recognition = ((globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);

    if (typeof Recognition !== 'function') {
      setNotice('Voice dictation is not available in this browser. Paste the transcript instead.');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-ZA';
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setTranscript((current) => {
        const nextTranscript = `${current}${current ? ' ' : ''}${text}`.trim();
        transcriptRef.current = nextTranscript;
        return nextTranscript;
      });
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }

  function appendTranscriptSnippet(snippet: string) {
    const currentTranscript = getCurrentTranscript().trim();
    const nextTranscript = `${currentTranscript}${currentTranscript ? ' ' : ''}${snippet}`.trim();
    updateTranscript(nextTranscript);
    transcriptInputRef.current?.focus();
  }

  function analyseTranscript() {
    reviewTranscript();
  }

  const selectedSuggestions = suggestions.filter((suggestion) => suggestion.selected);
  const hasTranscript = Boolean(transcript.trim());
  const canReviewTranscript = projects.length > 0 && hasTranscript && !transcribeMutation.isPending && !applyMutation.isPending;
  const selectedCountLabel = `${selectedSuggestions.length} selected`;
  const reviewStateMessage = reviewState === 'matches'
    ? 'Detected updates are staged below. Check the project, stage, dates, comments, and tasks before saving.'
    : reviewState === 'no_matches'
      ? 'No project was confidently detected. Use the structured update form to choose the project yourself.'
      : reviewState === 'manual_added'
        ? 'A structured update is queued. Review it on the right, then submit the selected update.'
        : reviewState === 'applying'
          ? 'Saving selected updates to the project records. The queue stays visible if saving fails.'
          : reviewState === 'applied'
            ? 'Updates were saved. Use the project links below to confirm the result.'
            : reviewState === 'error'
              ? 'Something needs attention. The detailed message is shown below.'
              : 'Paste a transcript, transcribe an audio file, or create a structured update to start a review queue.';

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(20,184,166,0.08),rgba(2,6,23,0.72))] p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-sky-300">Voice updates</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Speak once. Review carefully. Update the workspace.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Capture site feedback on mobile, match it to projects, then save only the updates you approve.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            Review required before save
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">1. Capture</p>
            <p className="mt-2 font-medium text-white">Dictate or upload</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">2. Review</p>
            <p className="mt-2 font-medium text-white">Check every match</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">3. Save</p>
            <p className="mt-2 font-medium text-white">Update selected projects</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 shadow-soft sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startDictation}
              disabled={isListening}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Mic2 className="h-4 w-4" />
              {isListening ? 'Listening...' : 'Start dictation'}
            </button>
            <button
              type="button"
              onClick={analyseTranscript}
              disabled={!canReviewTranscript}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              Review transcript
            </button>
          </div>

          <div className="mt-4 rounded-3xl border border-sky-400/15 bg-sky-500/8 p-4">
            <p className="text-sm font-semibold text-white">Mobile voice script</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">For best matching, say the project name first, then the stage, date, blockers, and follow-up tasks.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {voicePromptChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendTranscriptSnippet(chip)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => appendTranscriptSnippet(sampleVoiceUpdate)}
              className="mt-3 w-full rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-left text-xs font-semibold leading-5 text-sky-100 transition hover:bg-sky-400/15"
            >
              Insert sample update
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <label className="grid gap-2 text-sm text-slate-300">
              Voice note upload
              <input
                type="file"
                accept="audio/aac,audio/m4a,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,video/mp4,.aac,.m4a,.mp3,.ogg,.wav,.webm,.mp4"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-400">
                {audioFile ? `${audioFile.name} · ${(audioFile.size / 1024 / 1024).toFixed(1)} MB` : 'Upload a WhatsApp voice note, MP3, WAV, OGG, WebM, AAC, or MP4 audio file.'}
              </p>
              <button
                type="button"
                onClick={() => audioFile && transcribeMutation.mutate(audioFile)}
                disabled={!audioFile || transcribeMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mic2 className="h-4 w-4" />
                {transcribeMutation.isPending ? 'Transcribing...' : 'Transcribe file'}
              </button>
            </div>
          </div>

          <label className="mt-5 grid gap-2 text-sm text-slate-300">
            Transcript
            <textarea
              ref={transcriptInputRef}
              value={transcript}
              onChange={(event) => updateTranscript(event.target.value)}
              rows={10}
              className="min-h-56 rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 sm:min-h-72 sm:text-sm sm:leading-6"
              placeholder="PSG Hermanus is now in production. ABC Signage confirmed installation for 15 August. Cape Town Waterfront is delayed waiting for artwork approval."
            />
          </label>
          <div className="mt-3 grid gap-3 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={analyseTranscript}
              disabled={!canReviewTranscript}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              Review transcript
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
            {reviewStateMessage}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">Structured update</h3>
              <p className="text-xs text-slate-400">Use this when the transcript does not name the project clearly.</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Project
                <select
                  value={manualForm.projectId}
                  onChange={(event) => updateManualForm({ projectId: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                >
                  <option value="">Select project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.branch} · {project.id}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Stage
                <select
                  value={manualForm.currentStage}
                  onChange={(event) => updateManualForm({ currentStage: event.target.value as ManualVoiceUpdateForm['currentStage'] })}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                >
                  <option value="">No stage change</option>
                  {timelineStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Status
                <select
                  value={manualForm.status}
                  onChange={(event) => updateManualForm({ status: event.target.value as ManualVoiceUpdateForm['status'] })}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                >
                  <option value="">No status change</option>
                  {statusOptions.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Installation date
                <input
                  value={manualForm.installationDate}
                  onChange={(event) => updateManualForm({ installationDate: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                  placeholder="15 August"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Target date
                <input
                  value={manualForm.targetDate}
                  onChange={(event) => updateManualForm({ targetDate: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                  placeholder="30 August"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Comment
                <textarea
                  value={manualForm.comment}
                  onChange={(event) => updateManualForm({ comment: event.target.value })}
                  rows={3}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                  placeholder="Branch confirmed production is underway."
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
                Tasks
                <textarea
                  value={manualForm.tasks}
                  onChange={(event) => updateManualForm({ tasks: event.target.value })}
                  rows={2}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                  placeholder="One task per line"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={addManualUpdateToReviewQueue}
                disabled={projects.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardCheck className="h-4 w-4" />
                Add form update to review queue
              </button>
            </div>
          </div>

          {notice ? <p className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{notice}</p> : null}
          {appliedProjects.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p className="font-semibold">Updated projects</p>
              <div className="mt-2 grid gap-2">
                {appliedProjects.map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="rounded-xl border border-emerald-300/15 bg-emerald-950/30 px-3 py-2 transition hover:bg-emerald-900/40">
                    {project.branch} · {project.currentStage} · {project.status.replace(/_/g, ' ')}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {transcribeMutation.error instanceof Error ? <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{transcribeMutation.error.message}</p> : null}
          {applyMutation.error instanceof Error ? <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{applyMutation.error.message}</p> : null}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 shadow-soft sm:p-5">
          <div className="sticky top-20 z-20 -mx-1 rounded-3xl border border-white/10 bg-slate-950/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Review queue</h3>
              <p className="mt-1 text-sm text-slate-400">{selectedCountLabel} from {suggestions.length} detected</p>
            </div>
            <button
              type="button"
              onClick={() => applyMutation.mutate(selectedSuggestions)}
              disabled={selectedSuggestions.length === 0 || applyMutation.isPending}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {applyMutation.isPending ? 'Submitting...' : 'Submit selected to project'}
            </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {suggestions.length > 0 ? suggestions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex items-start gap-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={suggestion.selected}
                      onChange={(event) => updateSuggestion(suggestion.id, { selected: event.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950"
                    />
                    <span>
                      <span className="block font-semibold text-white">{suggestion.branch}</span>
                      <span className="mt-1 block text-xs text-slate-400">{suggestion.projectId}</span>
                    </span>
                  </label>
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                    {Math.round(suggestion.confidence * 100)}% match
                  </span>
                </div>

                <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-slate-300">{suggestion.excerpt}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate-300">
                    Stage
                    <select
                      value={suggestion.currentStage ?? ''}
                      onChange={(event) => {
                        const stage = event.target.value as ProjectStage;
                        updateSuggestion(suggestion.id, {
                          currentStage: stage || undefined,
                          progress: stage ? progressForStage(stage) : undefined,
                          status: stage ? statusForStage(stage, suggestion.status ?? 'in_progress') : suggestion.status,
                        });
                      }}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                    >
                      <option value="">No stage change</option>
                      {timelineStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-slate-300">
                    Status
                    <select
                      value={suggestion.status ?? ''}
                      onChange={(event) => updateSuggestion(suggestion.id, { status: event.target.value as ProjectStatus || undefined })}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                    >
                      <option value="">No status change</option>
                      {statusOptions.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-slate-300">
                    Installation date
                    <input
                      value={suggestion.installationDate ?? ''}
                      onChange={(event) => updateSuggestion(suggestion.id, { installationDate: event.target.value || undefined })}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                      placeholder="15 August"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-300">
                    Target date
                    <input
                      value={suggestion.targetDate ?? ''}
                      onChange={(event) => updateSuggestion(suggestion.id, { targetDate: event.target.value || undefined })}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                      placeholder="30 August"
                    />
                  </label>
                </div>

                <label className="mt-4 grid gap-2 text-sm text-slate-300">
                  Comment
                  <textarea
                    value={suggestion.comment}
                    onChange={(event) => updateSuggestion(suggestion.id, { comment: event.target.value })}
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                  />
                </label>

                <label className="mt-4 grid gap-2 text-sm text-slate-300">
                  Tasks
                  <textarea
                    value={suggestion.tasks}
                    onChange={(event) => updateSuggestion(suggestion.id, { tasks: event.target.value })}
                    rows={2}
                    className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50"
                    placeholder="One task per line"
                  />
                </label>
              </article>
            )) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-400">
                No updates waiting for review.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}