import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getAllBranches, updateBranch } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';
import { filterActivityExcludingUser } from '../utils/activityFilter';
import { buildBranchCodeMap, getBranchCodeForBranch } from '../utils/branchProjectIds';
import type { Branch, Project, TaskAssignee } from '../types/domain';
import { createProject, addProjectTask, addProjectComment, uploadProjectFile } from '../services/portalService';

function byUpdatedAtDesc(a: Project, b: Project) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function projectParticipants(project: Project) {
  const participants = new Map<string, TaskAssignee>();

  project.tasks.forEach((task) => {
    task.assignees?.forEach((assignee) => {
      participants.set(assignee.email.toLowerCase(), assignee);
    });

    if (task.assigneeEmail && task.assigneeName) {
      const key = task.assigneeEmail.toLowerCase();
      if (!participants.has(key)) {
        participants.set(key, {
          name: task.assigneeName,
          email: task.assigneeEmail,
          designation: 'Participant',
        });
      }
    }
  });

  return [...participants.values()];
}

export function BranchDetailPage() {
  const { branchId } = useParams();
  const { user } = useAuth();

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: getAllBranches,
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const branch = branches.find((item) => item.id === (branchId ?? ''));
  const scopedProjects = filterProjectsForUser(projects, user);
  const codeByBranchId = useMemo(() => buildBranchCodeMap(branches), [branches]);
  const branchProjects = useMemo(() => {
    if (!branch) {
      return [];
    }

    return scopedProjects
      .filter((project) => project.branchId === branch.id || project.branch.toLowerCase() === branch.name.toLowerCase())
      .sort(byUpdatedAtDesc);
  }, [branch, scopedProjects]);

  const canonicalProject = branchProjects[0];
  const branchManager = canonicalProject?.manager ?? branch?.contactName ?? undefined;
  const branchManagerLabel = canonicalProject?.manager ? 'Project manager' : 'Branch manager';
  const outstandingTasks = branchProjects.reduce((count, project) => count + project.tasks.filter((task) => !task.completed).length, 0);
  const totalFiles = branchProjects.reduce((count, project) => count + project.files.length, 0);

  const queryClient = useQueryClient();
  const [branchTaskText, setBranchTaskText] = useState('');
  const [branchComment, setBranchComment] = useState('');
  const [branchUploading, setBranchUploading] = useState(false);
  const [branchWorkspaceError, setBranchWorkspaceError] = useState<string | null>(null);
  const [branchWorkspaceSuccess, setBranchWorkspaceSuccess] = useState<string | null>(null);
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [branchEditError, setBranchEditError] = useState<string | null>(null);
  const [branchEditSuccess, setBranchEditSuccess] = useState<string | null>(null);
  const [editBranchData, setEditBranchData] = useState({
    name: '',
    division: 'Wealth' as Branch['division'],
    province: '',
    town: '',
    physicalAddress: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: 'Contact Person',
  });

  const createBranchProjectMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createProject>[0]) => createProject(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const addBranchTaskMutation = useMutation({
    mutationFn: ({ projectId, text, assigneeName, assigneeEmail }: { projectId: string; text: string; assigneeName: string; assigneeEmail: string }) => addProjectTask({
      projectId,
      task: text,
      actor: user?.name ?? assigneeName,
      assigneeName,
      assigneeEmail,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const addBranchCommentMutation = useMutation({
    mutationFn: ({ projectId, message, author }: { projectId: string; message: string; author: string }) => addProjectComment({ projectId, author, message }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const uploadBranchFileMutation = useMutation({
    mutationFn: ({ projectId, file, currentFiles }: { projectId: string; file: File; currentFiles: import('../types/domain').ProjectFile[] }) => uploadProjectFile(projectId, file, currentFiles),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  function getBranchPrimaryContact() {
    const contact = branch?.contacts?.find((c) => c.designation?.toLowerCase().includes('contact'))
      ?? (branch?.contactName ? {
        name: branch.contactName,
        email: branch.contactEmail,
        phone: branch.contactPhone,
        designation: 'Contact Person',
      } : undefined);

    if (contact?.email && contact?.name) {
      return contact;
    }

    if (user?.email && user?.name) {
      return { name: user.name, email: user.email, phone: undefined, designation: 'Branch participant' };
    }

    return undefined;
  }

  async function ensureBranchProject() {
    if (!branch) {
      throw new Error('Branch not available.');
    }

    const desiredId = `branch-${branch.id}`;
    const existing = branchProjects.find((p) => p.id === desiredId) ?? branchProjects.find((p) => p.branchId === branch.id);
    if (existing) {
      return existing.id;
    }

    const payload = {
      id: desiredId,
      branchId: branch.id,
      branch: branch.name,
      branchCode: getBranchCodeForBranch(branch, codeByBranchId),
      province: branch.province ?? '',
      town: branch.town ?? '',
      physicalAddress: branch.physicalAddress ?? '',
      currentStage: 'Branch setup',
      status: 'in_progress' as const,
      targetDate: '',
      installationDate: '',
      completionDate: '',
      progress: 0,
    } as const;

    const result = await createBranchProjectMutation.mutateAsync(payload as any);
    return result.id;
  }

  async function handleAddBranchTask() {
    setBranchWorkspaceError(null);
    setBranchWorkspaceSuccess(null);
    if (!branchTaskText.trim()) return;
    try {
      const projectId = await ensureBranchProject();
      const primaryContact = getBranchPrimaryContact();
      await addBranchTaskMutation.mutateAsync({
        projectId,
        text: branchTaskText.trim(),
        assigneeName: primaryContact?.name ?? user?.name ?? 'Branch user',
        assigneeEmail: primaryContact?.email ?? user?.email ?? '',
      });
      setBranchTaskText('');
      setBranchWorkspaceSuccess('Branch task added.');
    } catch (err) {
      setBranchWorkspaceError(err instanceof Error ? err.message : 'Unable to add branch task.');
    }
  }

  async function handleAddBranchComment() {
    setBranchWorkspaceError(null);
    setBranchWorkspaceSuccess(null);
    if (!branchComment.trim()) return;
    try {
      const projectId = await ensureBranchProject();
      const author = user?.name ?? getBranchPrimaryContact()?.name ?? 'Branch user';
      await addBranchCommentMutation.mutateAsync({ projectId, message: branchComment.trim(), author });
      setBranchComment('');
      setBranchWorkspaceSuccess('Branch comment saved.');
    } catch (err) {
      setBranchWorkspaceError(err instanceof Error ? err.message : 'Unable to add branch comment.');
    }
  }

  async function handleBranchFileUpload(file: File) {
    setBranchWorkspaceError(null);
    setBranchWorkspaceSuccess(null);
    if (!file) return;
    setBranchUploading(true);
    try {
      const projectId = await ensureBranchProject();
      const existing = branchProjects.find((p) => p.id === projectId) ?? branchProjects.find((p) => p.branchId === branch?.id);
      const currentFiles = existing?.files ?? [];
      await uploadBranchFileMutation.mutateAsync({ projectId, file, currentFiles });
      setBranchWorkspaceSuccess('File uploaded to branch workspace.');
    } catch (err) {
      setBranchWorkspaceError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setBranchUploading(false);
    }
  }

  if (isLoadingBranches || isLoadingProjects) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Loading branch workspace...</div>;
  }

  if (!branch) {
    return <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 text-sm text-slate-300 shadow-soft">Branch not found.</div>;
  }

  const branchCode = getBranchCodeForBranch(branch, codeByBranchId);

  useEffect(() => {
    if (!branch) {
      return;
    }

    setEditBranchData({
      name: branch.name,
      division: branch.division,
      province: branch.province,
      town: branch.town,
      physicalAddress: branch.physicalAddress,
      contactName: branch.contactName ?? '',
      contactEmail: branch.contactEmail ?? '',
      contactPhone: branch.contactPhone ?? '',
      contactDesignation: branch.contacts?.[0]?.designation ?? 'Contact Person',
    });
  }, [branch]);

  async function handleBranchUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBranchEditError(null);
    setBranchEditSuccess(null);

    if (!branch) {
      setBranchEditError('Branch not available.');
      return;
    }

    if (!editBranchData.name || !editBranchData.province || !editBranchData.town || !editBranchData.physicalAddress) {
      setBranchEditError('Name, province, town, and physical address are required.');
      return;
    }

    try {
      await updateBranch(branch.id, {
        name: editBranchData.name,
        division: editBranchData.division,
        province: editBranchData.province,
        town: editBranchData.town,
        physicalAddress: editBranchData.physicalAddress,
        contactName: editBranchData.contactName.trim() || null,
        contactEmail: editBranchData.contactEmail.trim() || null,
        contactPhone: editBranchData.contactPhone.trim() || null,
        contacts: editBranchData.contactName.trim()
          ? [{
            name: editBranchData.contactName.trim(),
            email: editBranchData.contactEmail.trim() || undefined,
            phone: editBranchData.contactPhone.trim() || undefined,
            designation: editBranchData.contactDesignation.trim() || 'Contact Person',
          }]
          : [],
      });
      setBranchEditSuccess('Branch updated successfully.');
      setIsEditingBranch(false);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (err) {
      setBranchEditError(err instanceof Error ? err.message : 'Unable to update branch.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Branch {branchCode}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{branch.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{branch.town}, {branch.province}</p>
            <p className="mt-2 text-sm text-slate-300">{branch.physicalAddress}</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
            <p>Branch manager: <span className="text-white">{branchManager ?? 'Not assigned'}</span></p>
            <p>Projects: <span className="text-white">{branchProjects.length}</span></p>
            <p>Outstanding tasks: <span className="text-white">{outstandingTasks}</span></p>
            <p>Files: <span className="text-white">{totalFiles}</span></p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch information</h3>
          <button type="button" onClick={() => setIsEditingBranch(true)} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
            Edit branch
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Branch name</p>
            <p className="mt-2 text-sm text-white">{branch.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Division</p>
            <p className="mt-2 text-sm text-white">{branch.division}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{branchManagerLabel}</p>
            <p className="mt-2 text-sm text-white">{branchManager ?? 'Not assigned'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Contact person</p>
            <p className="mt-2 text-sm text-white">{branch.contactName ?? 'Not assigned'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Contact details</p>
            <p className="mt-2 text-sm text-white">{branch.contactEmail || branch.contactPhone ? `${branch.contactEmail ?? ''}${branch.contactEmail && branch.contactPhone ? ' · ' : ''}${branch.contactPhone ?? ''}` : 'Not assigned'}</p>
          </div>
        </div>
      </section>

      {isEditingBranch ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Edit branch</h3>
            <button type="button" onClick={() => setIsEditingBranch(false)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
              Cancel
            </button>
          </div>

          <form onSubmit={handleBranchUpdate} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Name</span>
              <input value={editBranchData.name} onChange={(e) => setEditBranchData((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Division</span>
              <select value={editBranchData.division} onChange={(e) => setEditBranchData((prev) => ({ ...prev, division: e.target.value as Branch['division'] }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white">
                <option value="Wealth">Wealth</option>
                <option value="Insure">Insure</option>
                <option value="Wealth Insure">Wealth Insure</option>
                <option value="Asset">Asset</option>
                <option value="Trust">Trust</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Province</span>
              <input value={editBranchData.province} onChange={(e) => setEditBranchData((prev) => ({ ...prev, province: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Town</span>
              <input value={editBranchData.town} onChange={(e) => setEditBranchData((prev) => ({ ...prev, town: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="md:col-span-2 space-y-2 text-sm text-slate-300">
              <span>Physical address</span>
              <input value={editBranchData.physicalAddress} onChange={(e) => setEditBranchData((prev) => ({ ...prev, physicalAddress: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Contact name</span>
              <input value={editBranchData.contactName} onChange={(e) => setEditBranchData((prev) => ({ ...prev, contactName: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Contact email</span>
              <input value={editBranchData.contactEmail} onChange={(e) => setEditBranchData((prev) => ({ ...prev, contactEmail: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Contact phone</span>
              <input value={editBranchData.contactPhone} onChange={(e) => setEditBranchData((prev) => ({ ...prev, contactPhone: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Contact designation</span>
              <input value={editBranchData.contactDesignation} onChange={(e) => setEditBranchData((prev) => ({ ...prev, contactDesignation: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
            </label>

            <div className="md:col-span-2 flex flex-col gap-3">
              {(branchEditError || branchEditSuccess) && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm">
                  {branchEditError ? <p className="text-red-300">{branchEditError}</p> : <p className="text-emerald-300">{branchEditSuccess}</p>}
                </div>
              )}
              <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                Save branch changes
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch workspace (add task, comment, file)</h3>
          <p className="text-sm text-slate-400">These create or update a branch-level project record.</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-slate-300">Add task</label>
            <div className="mt-2 flex gap-2">
              <input value={branchTaskText} onChange={(e) => setBranchTaskText(e.target.value)} placeholder="New branch task..." className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
              <button onClick={handleAddBranchTask} disabled={addBranchTaskMutation.status === 'pending'} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm text-slate-950">Add</button>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300">Add comment</label>
            <div className="mt-2 flex gap-2">
              <input value={branchComment} onChange={(e) => setBranchComment(e.target.value)} placeholder="Add a quick update..." className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white" />
              <button onClick={handleAddBranchComment} disabled={addBranchCommentMutation.status === 'pending'} className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm text-white">Save</button>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300">Upload file</label>
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm text-slate-100 cursor-pointer">
                {branchUploading ? 'Uploading...' : 'Choose file'}
                <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) handleBranchFileUpload(f); }} />
              </label>
            </div>
          </div>
        </div>
        {(branchWorkspaceError || branchWorkspaceSuccess) && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm">
            {branchWorkspaceError ? (
              <p className="text-red-300">{branchWorkspaceError}</p>
            ) : (
              <p className="text-emerald-300">{branchWorkspaceSuccess}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Branch project</h3>
        </div>

        <div className="mt-4 space-y-4">
          {branchProjects.length > 0 ? branchProjects.map((project) => {
            const participants = projectParticipants(project);
            const pendingTasks = project.tasks.filter((task) => !task.completed);
            const latestUpdates = [...project.comments].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);
            const latestActivity = filterActivityExcludingUser([...project.activity], user?.name)
              .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 5);

            return (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{project.id}</p>
                    <p className="mt-1 text-sm text-slate-300">{project.currentStage} · {project.status.replace('_', ' ')}</p>
                    <p className="mt-1 text-xs text-slate-400">Target {project.targetDate || 'Not set'} · Updated {project.updatedAt || 'Unknown'}</p>
                  </div>
                  <div className="text-sm text-slate-300">
                    <p>Manager: {project.manager || 'Not assigned'}</p>
                  </div>
                </div>

                    <div className="mt-3 flex gap-2">
                      <Link to={`/projects/${project.id}`} className="inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25">Project details</Link>
                    </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned participants</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {participants.length > 0 ? participants.map((participant) => (
                        <p key={`${project.id}-${participant.email}`}>{participant.name} · {participant.designation}</p>
                      )) : <p className="text-slate-400">No participants assigned yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending tasks</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-200">
                      {pendingTasks.length > 0 ? pendingTasks.slice(0, 5).map((task) => (
                        <p key={`${project.id}-${task.id}`}>{task.text}</p>
                      )) : <p className="text-slate-400">No pending tasks.</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Files</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-200">
                    {project.files.length > 0 ? project.files.map((file) => <p key={`${project.id}-${file.path ?? file.name}`}>{file.name}</p>) : <p className="text-slate-400">No files uploaded yet.</p>}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">All tasks</p>
                  <div className="mt-2 space-y-2 text-sm text-slate-200">
                    {project.tasks.length > 0 ? project.tasks.map((task) => (
                      <div key={`${project.id}-${task.id}`} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                        <p className={task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}>{task.text}</p>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">{task.completed ? 'Done' : (task.status ?? 'Open')}</span>
                      </div>
                    )) : <p className="text-slate-400">No tasks added yet.</p>}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest updates</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                      {latestUpdates.length > 0 ? latestUpdates.map((item, index) => (
                        <div key={`${project.id}-${item.author}-${item.date}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                          <p className="text-xs text-slate-400">{item.date}</p>
                          <p className="mt-1 font-medium text-white">{item.author}</p>
                          <p className="mt-1 text-slate-300">{item.message}</p>
                        </div>
                      )) : <p className="text-slate-400">No updates captured yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest activity</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                      {latestActivity.length > 0 ? latestActivity.map((item, index) => (
                        <div key={`${project.id}-${item.title}-${item.date}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                          <p className="text-xs text-slate-400">{item.date}</p>
                          <p className="mt-1 font-medium text-white">{item.title}</p>
                          <p className="mt-1 text-slate-300">{item.detail}</p>
                        </div>
                      )) : <p className="text-slate-400">No activity recorded yet.</p>}
                    </div>
                  </div>
                </div>
              </article>
            );
          }) : <p className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-400">No projects are linked to this branch yet.</p>}
        </div>
      </section>
    </div>
  );
}
