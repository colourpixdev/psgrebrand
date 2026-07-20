import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Mic2, Pause, Play, Send } from 'lucide-react';
import { FileGrid } from '../components/uploads/FileGrid';
import { Timeline } from '../components/timeline/Timeline';
import { timelineStages } from '../constants/portal';
import { addProjectComment, addProjectTask, answerProjectQuestion, askProjectQuestion, deleteProjectTask, getProjectById, getProjectFileUrl, markProjectQuestionRead, transcribeVoiceUpdateAudio, updateProjectTask, updateProjectWorkflow, uploadProjectFile, uploadVoiceUpdateAudio } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { canViewProject, getAllowedStageOptions, getRolePolicy, getWorkflowDenialReason } from '../utils/permissions';
import type { CommentItem, Project, ProjectFile, ProjectStatus, ProjectStage, TaskItem } from '../types/domain';

type RecordingStatus = 'idle' | 'recording' | 'paused';

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const statusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const voiceTranscriptRef = useRef('');
  const voiceRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceRecordingStatusRef = useRef<RecordingStatus>('idle');
  const [stage, setStage] = useState<ProjectStage>('New Project');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [progress, setProgress] = useState(0);
  const [commentMessage, setCommentMessage] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceRecordingStatus, setVoiceRecordingStatusState] = useState<RecordingStatus>('idle');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceAudioFile, setVoiceAudioFile] = useState<File | null>(null);
  const [questionMessage, setQuestionMessage] = useState('');
  const [questionStage, setQuestionStage] = useState<'' | ProjectStage>('');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerMessage, setAnswerMessage] = useState('');
  const [answerStage, setAnswerStage] = useState<ProjectStage>('New Project');
  const [answerStatus, setAnswerStatus] = useState<ProjectStatus>('in_progress');
  const [answerProgress, setAnswerProgress] = useState(0);
  const [answerTargetDate, setAnswerTargetDate] = useState('');
  const [answerInstallationDate, setAnswerInstallationDate] = useState('');
  const [taskText, setTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId ?? ''),
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (project) {
      setStage(project.currentStage);
      setStatus(project.status);
      setProgress(project.progress);

      if (globalThis.location.hash === '#voice-note') {
        requestAnimationFrame(() => document.getElementById('voice-note')?.scrollIntoView({ block: 'start' }));
      }
    }
  }, [project]);

  useEffect(() => () => {
    voiceRecognitionRef.current?.stop();
  }, []);

  function setVoiceRecordingStatus(nextStatus: RecordingStatus) {
    voiceRecordingStatusRef.current = nextStatus;
    setVoiceRecordingStatusState(nextStatus);
  }

  function updateVoiceTranscript(nextTranscript: string) {
    voiceTranscriptRef.current = nextTranscript;
    setVoiceTranscript(nextTranscript);
    setVoiceNotice(null);
  }

  const syncProject = async (updatedProject: Project) => {
    queryClient.setQueryData(['project', projectId], updatedProject);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['portal-summary'] }),
    ]);
  };

  const workflowMutation = useMutation({
    mutationFn: () => updateProjectWorkflow({
      projectId: projectId ?? '',
      currentStage: stage,
      status,
      progress,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: syncProject,
  });

  const commentMutation = useMutation({
    mutationFn: () => addProjectComment({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      message: commentMessage,
    }),
    onSuccess: async (updatedProject) => {
      setCommentMessage('');
      await syncProject(updatedProject);
    },
  });

  const voiceCommentMutation = useMutation({
    mutationFn: () => addProjectComment({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      message: `Voice note: ${voiceTranscriptRef.current.trim()}`,
    }),
    onSuccess: async (updatedProject) => {
      updateVoiceTranscript('');
      setVoiceAudioFile(null);
      setVoiceRecordingStatus('idle');
      setVoiceNotice('Voice note saved to this project.');
      await syncProject(updatedProject);
    },
    onError: (error) => {
      setVoiceNotice(error instanceof Error ? error.message : 'Unable to save the voice note.');
    },
  });

  const projectVoiceTranscribeMutation = useMutation({
    mutationFn: async (file: File) => {
      const upload = await uploadVoiceUpdateAudio(file);
      return transcribeVoiceUpdateAudio(upload.path);
    },
    onMutate: () => {
      setVoiceNotice('Transcribing voice note. Keep this project open until the transcript appears.');
    },
    onSuccess: (nextTranscript) => {
      updateVoiceTranscript(nextTranscript);
      setVoiceNotice('Voice note transcribed. Review the text, then save it to this project.');
    },
    onError: (error) => {
      setVoiceNotice(error instanceof Error ? error.message : 'Voice note transcription failed.');
    },
  });

  const questionMutation = useMutation({
    mutationFn: () => askProjectQuestion({
      projectId: projectId ?? '',
      author: user?.name ?? 'Workspace user',
      authorEmail: user?.email ?? '',
      message: questionMessage,
      requestStage: questionStage || undefined,
    }),
    onSuccess: async (updatedProject) => {
      setQuestionMessage('');
      setQuestionStage('');
      await syncProject(updatedProject);
    },
  });

  const answerQuestionMutation = useMutation({
    mutationFn: (question: CommentItem) => answerProjectQuestion({
      projectId: projectId ?? '',
      questionId: question.id ?? '',
      actor: user?.name ?? 'Workspace user',
      answer: answerMessage,
      currentStage: answerStage,
      status: answerStatus,
      progress: answerProgress,
      targetDate: answerTargetDate,
      installationDate: answerInstallationDate,
    }),
    onSuccess: async (updatedProject) => {
      setAnsweringQuestionId(null);
      setAnswerMessage('');
      await syncProject(updatedProject);
    },
  });

  const readQuestionMutation = useMutation({
    mutationFn: (question: CommentItem) => markProjectQuestionRead({
      projectId: projectId ?? '',
      questionId: question.id ?? '',
    }),
    onSuccess: syncProject,
  });

  const taskMutation = useMutation({
    mutationFn: () => addProjectTask({
      projectId: projectId ?? '',
      task: taskText,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      setTaskText('');
      await syncProject(updatedProject);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ task, text, completed }: { task: TaskItem; text?: string; completed?: boolean }) => updateProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      text,
      completed,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task: TaskItem) => deleteProjectTask({
      projectId: projectId ?? '',
      taskId: task.id,
      actor: user?.name ?? 'Workspace user',
    }),
    onSuccess: async (updatedProject) => {
      setEditingTaskId(null);
      setEditingTaskText('');
      await syncProject(updatedProject);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProjectFile(projectId ?? '', file, project?.files ?? []),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const url = await getProjectFileUrl(file, { download: true });
      if (!url) {
        return null;
      }

      return { url, name: file.name };
    },
    onSuccess: (download) => {
      if (download) {
        const link = document.createElement('a');
        link.href = download.url;
        link.download = download.name;
        link.rel = 'noreferrer';
        link.click();
      }
    },
  });

  const previewMutation = useMutation({
    mutationFn: (file: ProjectFile) => getProjectFileUrl(file),
    onSuccess: (url) => {
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
  });

  const fileError = uploadMutation.error ?? previewMutation.error ?? downloadMutation.error;
  const workflowError = workflowMutation.error ?? commentMutation.error ?? questionMutation.error ?? answerQuestionMutation.error ?? readQuestionMutation.error ?? taskMutation.error ?? updateTaskMutation.error ?? deleteTaskMutation.error;
  const rolePolicy = getRolePolicy(user);
  const canAdministerProjectDetails = Boolean(user?.isPlatformOwner);
  const canUploadFiles = canAdministerProjectDetails && Boolean(rolePolicy?.files.canUploadFiles);
  const canAddComments = Boolean(rolePolicy?.communication.canCreateComments);
  const canAskColourpix = Boolean(rolePolicy?.communication.canAskQuestions);
  const canAnswerColourpixQuestions = canAdministerProjectDetails && Boolean(rolePolicy?.communication.canAnswerQuestions);
  const canAddTasks = canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canCreateTasks);
  const canCompleteTasks = canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canCompleteTasks);
  const canDeleteTasks = canAdministerProjectDetails && Boolean(rolePolicy?.tasks.canDeleteTasks);
  const isVoiceRecording = voiceRecordingStatus === 'recording';
  const isVoiceRecordingPaused = voiceRecordingStatus === 'paused';
  const hasVoiceTranscript = Boolean(voiceTranscript.trim());

  function startProjectVoiceNote() {
    if (voiceRecordingStatusRef.current === 'recording') {
      return;
    }

    const Recognition = ((globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (globalThis as typeof globalThis & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);

    if (typeof Recognition !== 'function') {
      setVoiceNotice('Voice dictation is not available in this browser. Upload an audio file or type the update instead.');
      return;
    }

    const recognition = new Recognition();
    voiceRecognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-ZA';
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      const currentTranscript = voiceTranscriptRef.current.trim();
      updateVoiceTranscript(`${currentTranscript}${currentTranscript ? ' ' : ''}${text}`.trim());
    };
    recognition.onend = () => {
      voiceRecognitionRef.current = null;
      if (voiceRecordingStatusRef.current === 'recording') {
        setVoiceRecordingStatus('paused');
      }
    };
    recognition.onerror = () => {
      voiceRecognitionRef.current = null;
      setVoiceRecordingStatus('paused');
      setVoiceNotice('Recording paused after a browser dictation error. Continue recording or save the transcript already captured.');
    };
    recognition.start();
    setVoiceRecordingStatus('recording');
    setVoiceNotice(isVoiceRecordingPaused ? 'Recording resumed for this project.' : 'Recording started for this project.');
  }

  function pauseProjectVoiceNote() {
    if (voiceRecordingStatusRef.current !== 'recording') {
      return;
    }

    setVoiceRecordingStatus('paused');
    voiceRecognitionRef.current?.stop();
    setVoiceNotice('Recording paused. Continue recording or save this note to the project.');
  }

  function saveProjectVoiceNote() {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
    setVoiceRecordingStatus('idle');
    voiceCommentMutation.mutate();
  }

  function startAnswer(question: CommentItem) {
    setAnsweringQuestionId(question.id ?? null);
    setAnswerMessage(question.answer ?? '');
    setAnswerStage(project?.currentStage ?? 'New Project');
    setAnswerStatus(project?.status ?? 'in_progress');
    setAnswerProgress(project?.progress ?? 0);
    setAnswerTargetDate(project?.targetDate ?? '');
    setAnswerInstallationDate(project?.installationDate ?? '');
  }

  if (isLoading) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading project...</div>;
  }

  if (!project) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">No project data found in Supabase yet.</div>;
  }

  if (!canViewProject(user, project)) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">This project is not available for your role.</div>;
  }

  const selectedProject = project;
  const projectQuestions = selectedProject.comments.filter((comment) => comment.kind === 'question');
  const projectComments = selectedProject.comments.filter((comment) => comment.kind !== 'question');
  const isQuestionRequester = (question: CommentItem) => (question.requesterEmail ? question.requesterEmail === user?.email : question.author === user?.name);
  const unreadAnswers = projectQuestions.filter((question) => question.status === 'answered' && question.unreadForRequester && isQuestionRequester(question));
  const allowedStageOptions = getAllowedStageOptions(user, selectedProject, timelineStages);
  const hasAllowedStageChange = allowedStageOptions.some((item) => item !== selectedProject.currentStage);
  const workflowDenialReason = getWorkflowDenialReason(user, selectedProject, { currentStage: stage, status, progress });
  const hasWorkflowChange = stage !== selectedProject.currentStage || status !== selectedProject.status || progress !== selectedProject.progress;
  const canSubmitWorkflow = canAdministerProjectDetails && hasWorkflowChange && !workflowDenialReason;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Project ID {selectedProject.id}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{selectedProject.branch}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {selectedProject.town}, {selectedProject.province} · Manager {selectedProject.manager} · {selectedProject.deliveryPartnerLabel} {selectedProject.installer}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div>Workspace: <span className="text-white">{selectedProject.workspaceName}</span></div>
          <div>Client: <span className="text-white">{selectedProject.clientCompany}</span></div>
          <div>Project type: <span className="text-white">{selectedProject.projectTypeName}</span></div>
          <div>Service partner: <span className="text-white">{selectedProject.graphicsPartner}</span></div>
          <div>Current Status: <span className="text-white">{selectedProject.currentStage}</span></div>
          <div>Target Date: <span className="text-white">{selectedProject.targetDate}</span></div>
          <div>Installation Date: <span className="text-white">{selectedProject.installationDate}</span></div>
          <div>Completion Date: <span className="text-white">{selectedProject.completionDate}</span></div>
          <div className="md:col-span-4">Physical Address: <span className="text-white">{selectedProject.physicalAddress || 'Not captured'}</span></div>
        </div>
      </section>

      <section id="voice-note" className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-6 shadow-soft scroll-mt-24">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Send Francois an update</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Leave a text or voice note for this project</h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">These notes do not change the project details directly. They are saved to the project journal and sent to Francois for review.</p>
          </div>
          <Link to="/search" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">Find another project</Link>
        </div>

        <div id="project-note" className="mt-5 grid gap-3 scroll-mt-24">
          <label className="grid gap-2 text-sm text-slate-300">
            Text update
            <textarea value={commentMessage} disabled={!canAddComments} onChange={(event) => setCommentMessage(event.target.value)} rows={3} placeholder={canAddComments ? 'Type what changed, what is needed, or what Francois should check...' : 'Commenting restricted'} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm sm:leading-6" />
          </label>
          <button type="button" disabled={!canAddComments || commentMutation.isPending || !commentMessage.trim()} onClick={() => commentMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
            {commentMutation.isPending ? 'Sending update...' : 'Send text update'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" disabled={!canAddComments || isVoiceRecording} onClick={startProjectVoiceNote} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
            {isVoiceRecordingPaused ? <Play className="h-4 w-4" /> : <Mic2 className="h-4 w-4" />}
            {isVoiceRecording ? 'Listening...' : isVoiceRecordingPaused ? 'Continue recording' : 'Start recording'}
          </button>
          <button type="button" disabled={!isVoiceRecording} onClick={pauseProjectVoiceNote} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50">
            <Pause className="h-4 w-4" />
            Pause
          </button>
          <button type="button" disabled={!canAddComments || !hasVoiceTranscript || voiceCommentMutation.isPending} onClick={saveProjectVoiceNote} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" />
            {voiceCommentMutation.isPending ? 'Saving...' : 'Save note'}
          </button>
          <label className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
            <Mic2 className="h-4 w-4" />
            Upload audio
            <input type="file" accept="audio/aac,audio/m4a,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,video/mp4,.aac,.m4a,.mp3,.ogg,.wav,.webm,.mp4" className="sr-only" disabled={!canAddComments || projectVoiceTranscribeMutation.isPending} onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setVoiceAudioFile(file);
              if (file) {
                projectVoiceTranscribeMutation.mutate(file);
              }
              event.target.value = '';
            }} />
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm text-slate-300">
          Voice note transcript
          <textarea value={voiceTranscript} disabled={!canAddComments} onChange={(event) => updateVoiceTranscript(event.target.value)} rows={4} placeholder={canAddComments ? 'Record or type a quick project update...' : 'Voice updates restricted for your role'} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm sm:leading-6" />
        </label>
        <div className="mt-3 flex flex-col gap-2 text-xs leading-5 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{voiceAudioFile ? `${voiceAudioFile.name} selected` : 'Voice notes also go to Francois for review before project details are changed.'}</span>
          {projectVoiceTranscribeMutation.isPending ? <span className="text-sky-100">Transcribing audio...</span> : null}
        </div>
        {!canAddComments ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Your role can view this project but cannot add project voice notes.</p> : null}
        {voiceNotice ? <p className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{voiceNotice}</p> : null}
      </section>

      <Timeline stages={timelineStages} activeStage={selectedProject.currentStage} />

      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Questions and update requests</h3>
            <p className="mt-1 text-sm text-slate-400">PSG Wealth Insure and Colourpix users can ask, answer, and update project details in the same thread.</p>
          </div>
          {unreadAnswers.length > 0 ? <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">{unreadAnswers.length} new answer{unreadAnswers.length === 1 ? '' : 's'}</span> : null}
        </div>

        {canAskColourpix ? (
          <div className="mt-5 grid gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/10 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <label className="grid gap-2 text-sm text-slate-300">
                Question or update request
                <textarea value={questionMessage} onChange={(event) => setQuestionMessage(event.target.value)} rows={3} placeholder="Please confirm whether artwork approval is still blocking this stage." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50" />
              </label>
              <label className="grid content-start gap-2 text-sm text-slate-300">
                Related stage
                <select value={questionStage} onChange={(event) => setQuestionStage(event.target.value as '' | ProjectStage)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                  <option value="">General update</option>
                  {timelineStages.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <button type="button" disabled={questionMutation.isPending || !questionMessage.trim()} onClick={() => questionMutation.mutate()} className="w-fit rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
              {questionMutation.isPending ? 'Sending question...' : 'Send question'}
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {projectQuestions.length > 0 ? projectQuestions.map((question) => {
            const questionId = question.id ?? `${question.author}-${question.requestedAt ?? question.date}`;
            const isRequester = isQuestionRequester(question);
            const showAnswerForm = canAnswerColourpixQuestions && answeringQuestionId === question.id;

            return (
              <article key={questionId} className={`rounded-2xl border p-4 ${question.status === 'answered' ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-amber-400/20 bg-amber-500/10'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{question.author}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs text-slate-200">{question.status === 'answered' ? 'Answered' : 'Awaiting workspace team'}</span>
                      {question.requestStage ? <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-100">{question.requestStage}</span> : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{question.message}</p>
                    <p className="mt-2 text-xs text-slate-500">Asked {question.date}</p>
                  </div>
                  {question.status === 'answered' && question.unreadForRequester && isRequester ? (
                    <button type="button" disabled={readQuestionMutation.isPending} onClick={() => readQuestionMutation.mutate(question)} className="rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
                      Mark answer read
                    </button>
                  ) : null}
                </div>

                {question.answer || question.relatedChanges?.length ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-emerald-100">{question.answeredBy ?? 'Workspace team'}</span>
                      {question.answeredAt ? <span>{new Date(question.answeredAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</span> : null}
                    </div>
                    {question.answer ? <p className="mt-2 text-sm leading-6 text-slate-200">{question.answer}</p> : null}
                    {question.relatedChanges?.length ? (
                      <ul className="mt-3 grid gap-1 text-xs text-emerald-100">
                        {question.relatedChanges.map((change) => <li key={change}>{change}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {canAnswerColourpixQuestions ? (
                  <div className="mt-4">
                    {showAnswerForm ? (
                      <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                        <label className="grid gap-2 text-sm text-slate-300">
                          Answer
                          <textarea value={answerMessage} onChange={(event) => setAnswerMessage(event.target.value)} rows={3} placeholder="Share the latest update for PSG." className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50" />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer stage
                            <select value={answerStage} onChange={(event) => setAnswerStage(event.target.value as ProjectStage)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                              {timelineStages.map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer status
                            <select value={answerStatus} onChange={(event) => setAnswerStatus(event.target.value as ProjectStatus)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50">
                              {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Answer progress
                            <input type="number" min="0" max="100" value={answerProgress} onChange={(event) => setAnswerProgress(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Target date
                            <input value={answerTargetDate} onChange={(event) => setAnswerTargetDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Installation date
                            <input value={answerInstallationDate} onChange={(event) => setAnswerInstallationDate(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50" />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={answerQuestionMutation.isPending || (!answerMessage.trim() && answerStage === selectedProject.currentStage && answerStatus === selectedProject.status && answerProgress === selectedProject.progress && answerTargetDate === selectedProject.targetDate && answerInstallationDate === selectedProject.installationDate)} onClick={() => answerQuestionMutation.mutate(question)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                            {answerQuestionMutation.isPending ? 'Sending answer...' : 'Answer and update'}
                          </button>
                          <button type="button" onClick={() => setAnsweringQuestionId(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => startAnswer(question)} className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
                        {question.status === 'answered' ? 'Update answer' : 'Answer request'}
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            );
          }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No project questions yet.</p>}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Workflow Actions</h3>
          <p className="mt-1 text-sm text-slate-400">Francois administers project detail changes. Other users should leave text or voice updates at the top of this page.</p>
          {!canAdministerProjectDetails ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Direct project detail editing is restricted. Leave an update above for Francois to review.</p> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Stage
              <select value={stage} disabled={!canAdministerProjectDetails || !rolePolicy?.workflow.canChangeStage || !hasAllowedStageChange} onChange={(event) => setStage(event.target.value as ProjectStage)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
                {allowedStageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Status
              <select value={status} disabled={!canAdministerProjectDetails || !rolePolicy?.workflow.canChangeStatus} onChange={(event) => setStatus(event.target.value as ProjectStatus)} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60">
                {statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300 md:col-span-2">
              Progress
              <input type="range" min="0" max="100" value={progress} disabled={!canAdministerProjectDetails || !rolePolicy?.workflow.canChangeProgress} onChange={(event) => setProgress(Number(event.target.value))} className="accent-sky-400 disabled:cursor-not-allowed disabled:opacity-60" />
            </label>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white">{progress}% complete</div>
          </div>

          {workflowError instanceof Error ? <p className="mt-4 text-sm text-red-300">{workflowError.message}</p> : null}
          {workflowDenialReason && hasWorkflowChange ? <p className="mt-4 text-sm text-amber-200">{workflowDenialReason}</p> : null}

          <button type="button" disabled={!canSubmitWorkflow || workflowMutation.isPending} onClick={() => workflowMutation.mutate()} className="mt-5 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
            {workflowMutation.isPending ? 'Updating workflow...' : 'Update workflow'}
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
          <h3 className="text-lg font-semibold text-white">Tasks</h3>
          <div className="mt-4 flex gap-3">
            <input value={taskText} disabled={!canAddTasks} onChange={(event) => setTaskText(event.target.value)} placeholder={canAddTasks ? 'Add next action...' : 'Task updates restricted'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/50 disabled:cursor-not-allowed disabled:opacity-60" />
            <button type="button" disabled={!canAddTasks || taskMutation.isPending || !taskText.trim()} onClick={() => taskMutation.mutate()} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
              Add
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {selectedProject.tasks.length > 0 ? selectedProject.tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                {editingTaskId === task.id ? (
                  <div className="grid gap-3">
                    <input value={editingTaskText} onChange={(event) => setEditingTaskText(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/50" />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={updateTaskMutation.isPending || !editingTaskText.trim()} onClick={() => updateTaskMutation.mutate({ task, text: editingTaskText })} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => { setEditingTaskId(null); setEditingTaskText(''); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input type="checkbox" checked={task.completed} disabled={!canCompleteTasks || updateTaskMutation.isPending} onChange={(event) => updateTaskMutation.mutate({ task, completed: event.target.checked })} className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-50" />
                      <span className={task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}>{task.text}</span>
                    </label>
                    {canAddTasks || canDeleteTasks ? (
                      <div className="flex shrink-0 gap-2">
                        {canAddTasks ? <button type="button" onClick={() => { setEditingTaskId(task.id); setEditingTaskText(task.text); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Edit</button> : null}
                        {canDeleteTasks ? <button type="button" disabled={deleteTaskMutation.isPending} onClick={() => deleteTaskMutation.mutate(task)} className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">Delete</button> : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No open tasks.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <FileGrid
          files={selectedProject.files}
          isUploading={uploadMutation.isPending || previewMutation.isPending || downloadMutation.isPending}
          uploadError={fileError instanceof Error ? fileError.message : null}
          canUpload={canUploadFiles}
          onUpload={(file) => uploadMutation.mutate(file)}
          onPreview={(file: ProjectFile) => previewMutation.mutate(file)}
          onDownload={(file: ProjectFile) => downloadMutation.mutate(file)}
        />
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Notes</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">{selectedProject.notes}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Project Journal</h3>
            <div className="mt-4 space-y-3">
              {selectedProject.activity.length > 0 ? selectedProject.activity.map((item, index) => (
                <div key={`${item.date}-${item.title}-${item.detail}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="shrink-0 text-xs text-slate-500">{item.date}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                </div>
              )) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No activity recorded yet.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Text and voice update history</h3>
            <p className="mt-1 text-sm text-slate-400">Updates left for Francois appear here after they are saved.</p>
            <div className="mt-4 space-y-4">
              {projectComments.map((comment) => (
                <div key={`${comment.date}-${comment.author}-${comment.message}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-medium text-white">{comment.author}</p>
                    <p className="text-slate-500">{comment.date}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{comment.message}</p>
                </div>
              ))}
              {projectComments.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No comments recorded yet.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
