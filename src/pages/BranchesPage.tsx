import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getAllBranches, createBranchProject, updateBranch, deleteBranch, formatBranchName, extractBranchName, formatBranchLocation } from '../services/branchService';
import { getProjects } from '../services/portalService';
import { getUsers } from '../services/userService';
import type { Branch, ContactPerson, Division, Project, UserRecord } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';
import { useSaveFeedback } from '../contexts/SaveFeedbackContext';
import { ProjectFollowButton } from '../components/projects/ProjectFollowButton';
import { isPlatformOwnerEmail } from '../constants/workspaces';
import { filterProjectsForUser } from '../utils/permissions';

const divisions: Division[] = ['Wealth', 'Insure', 'Wealth Insure', 'Asset', 'Trust'];

function isPrimaryContactDesignation(designation: string) {
  const normalized = designation.trim().toLowerCase();
  return normalized === 'branch contact' || normalized === 'contact person';
}

function hasLegacyPrimaryContact(branch: Pick<Branch, 'contactName' | 'contactEmail' | 'contactPhone'>) {
  return Boolean(branch.contactName?.trim() || branch.contactEmail?.trim() || branch.contactPhone?.trim());
}

function getEditablePrimaryContact(branch: Branch) {
  if (hasLegacyPrimaryContact(branch)) {
    return {
      name: branch.contactName ?? '',
      email: branch.contactEmail,
      phone: branch.contactPhone,
      designation: branch.contacts?.[0]?.designation ?? 'Contact Person',
    } satisfies ContactPerson;
  }

  return branch.contacts?.find((contact) => isPrimaryContactDesignation(contact.designation)) ?? branch.contacts?.[0];
}

function getBranchPrimaryContact(branch: Branch) {
  return getEditablePrimaryContact(branch) ?? branch.contacts?.[0];
}

function getAdditionalBranchContacts(branch: Branch) {
  const primaryContact = getEditablePrimaryContact(branch);

  if (!primaryContact) {
    return branch.contacts ?? [];
  }

  let skippedPrimary = false;
  return (branch.contacts ?? []).filter((contact) => {
    if (!skippedPrimary
      && contact.name === primaryContact.name
      && (contact.email ?? '') === (primaryContact.email ?? '')
      && (contact.phone ?? '') === (primaryContact.phone ?? '')
      && contact.designation === primaryContact.designation) {
      skippedPrimary = true;
      return false;
    }

    return true;
  });
}

function ParticipantFields({ contacts, onChange }: { contacts: ContactPerson[]; onChange: (contacts: ContactPerson[]) => void }) {
  function updateContact(index: number, field: keyof ContactPerson, value: string) {
    onChange(contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, [field]: value } : contact));
  }

  return (
    <div className="mb-6 border-t border-white/10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Additional contact persons</p>
          <p className="mt-1 text-xs text-white">Add other contact persons and their designations.</p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange([...contacts, { name: '', email: '', phone: '', designation: '' }]); }} className="rounded-xl border border-sky-400/30 px-3 py-2 text-sm text-white transition hover:bg-sky-400/10">Add contact person</button>
      </div>
      <div className="mt-3 space-y-3">
        {contacts.map((contact, index) => (
          <div key={`${contact.email}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <input type="text" value={contact.name} onChange={(event) => updateContact(index, 'name', event.target.value)} placeholder="Name" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="text" value={contact.designation} onChange={(event) => updateContact(index, 'designation', event.target.value)} placeholder="Designation" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="email" value={contact.email ?? ''} onChange={(event) => updateContact(index, 'email', event.target.value)} placeholder="Email" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="text" value={contact.phone ?? ''} onChange={(event) => updateContact(index, 'phone', event.target.value)} placeholder="Phone" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(contacts.filter((_, contactIndex) => contactIndex !== index)); }} className="text-sm text-red-200 transition hover:text-red-100">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [pendingDeleteBranch, setPendingDeleteBranch] = useState<Branch | null>(null);
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    division: 'Wealth' as Division,
    province: '',
    town: '',
    physicalAddress: '',
    signageCompany: '',
    signageContactName: '',
    signageContactPhone: '',
    signageContactEmail: '',
    signageAddress: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    contacts: [] as ContactPerson[],
    marketingCoordinatorEmail: '',
  });
  const [editData, setEditData] = useState({
    name: '',
    division: 'Wealth' as Division,
    province: '',
    town: '',
    physicalAddress: '',
    signageCompany: '',
    signageContactName: '',
    signageContactPhone: '',
    signageContactEmail: '',
    signageAddress: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    contacts: [] as ContactPerson[],
    marketingCoordinatorEmail: '',
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useSaveFeedback();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'colourpix_admin' || isPlatformOwnerEmail(user?.email);

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadProjects() {
    try {
      const data = await getProjects({ includeFiles: false });
      setProjects(filterProjectsForUser(data, user));
    } catch (err) {
      console.error('Failed to load projects for branches page:', err);
    }
  }

  async function loadPageData() {
    setLoading(true);
    setError(null);
    const [branchesResult, projectsResult] = await Promise.allSettled([getAllBranches(), getProjects({ includeFiles: false })]);

    if (branchesResult.status === 'fulfilled') {
      setBranches(branchesResult.value);
    } else {
      setError(branchesResult.reason instanceof Error ? branchesResult.reason.message : 'Failed to load branches');
    }

    if (projectsResult.status === 'fulfilled') {
      setProjects(filterProjectsForUser(projectsResult.value, user));
    } else if (branchesResult.status === 'fulfilled') {
      setError(projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Failed to load projects');
    }

    try {
      setUsers(await getUsers());
    } catch {
      setUsers([]);
    }

    setLoading(false);
  }

  async function loadBranches() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllBranches();
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    if (!formData.name || !formData.province || !formData.town || !formData.physicalAddress) {
      setError('Name, province, town, and physical address are required');
      return;
    }

    try {
      setSaving(true);
      const { branch: createdBranch, project: createdProject } = await createBranchProject({
        name: formData.name.trim(),
        division: formData.division,
        province: formData.province,
        city: null,
        town: formData.town,
        physicalAddress: formData.physicalAddress,
        signageCompany: formData.signageCompany.trim() || null,
        signageContactName: formData.signageContactName.trim() || null,
        signageContactPhone: formData.signageContactPhone.trim() || null,
        signageContactEmail: formData.signageContactEmail.trim() || null,
        signageAddress: formData.signageAddress.trim() || null,
        contactName: formData.contactName.trim() || null,
        contactEmail: formData.contactEmail.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        contacts: [
          ...(formData.contactName.trim() ? [{
            name: formData.contactName.trim(),
            email: formData.contactEmail.trim() || undefined,
            phone: formData.contactPhone.trim() || undefined,
            designation: formData.contactDesignation.trim() || 'Contact Person',
          }] : []),
          ...formData.contacts.filter((contact) => contact.name.trim()),
        ],
        marketingCoordinatorName: users.find((item) => item.email === formData.marketingCoordinatorEmail)?.name ?? null,
        marketingCoordinatorEmail: formData.marketingCoordinatorEmail || null,
      });

      setFormData({
        name: '',
        division: 'Wealth',
        province: '',
        town: '',
        physicalAddress: '',
        signageCompany: '',
        signageContactName: '',
        signageContactPhone: '',
        signageContactEmail: '',
        signageAddress: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        contactDesignation: '',
        contacts: [],
        marketingCoordinatorEmail: '',
      });
      setShowForm(false);
      setError(null);
      setSuccessMessage(`Branch \"${formData.name}\" was created successfully.`);
      showSuccess('Branch saved.');
      if (createdBranch && createdProject) {
        navigate(`/projects/${encodeURIComponent(createdProject.id)}`);
        return;
      }
      await loadBranches();
    } catch (err) {
      setSuccessMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(branch: Branch) {
    setEditingBranchId(branch.id);
    const primaryContact = getEditablePrimaryContact(branch);
    setEditData({
      name: extractBranchName(branch.name),
      division: branch.division,
      province: branch.province,
      town: branch.town,
      physicalAddress: branch.physicalAddress,
      signageCompany: branch.signageCompany ?? '',
      signageContactName: branch.signageContactName ?? '',
      signageContactPhone: branch.signageContactPhone ?? '',
      signageContactEmail: branch.signageContactEmail ?? '',
      signageAddress: branch.signageAddress ?? '',
      contactName: primaryContact?.name ?? branch.contactName ?? '',
      contactEmail: primaryContact?.email ?? branch.contactEmail ?? '',
      contactPhone: primaryContact?.phone ?? branch.contactPhone ?? '',
      contactDesignation: primaryContact?.designation ?? '',
      contacts: getAdditionalBranchContacts(branch),
      marketingCoordinatorEmail: branch.marketingCoordinatorEmail ?? '',
    });
    setError(null);
    setSuccessMessage(null);
  }

  function cancelEdit() {
    setEditingBranchId(null);
    setEditData({
      name: '',
      division: 'Wealth',
      province: '',
      town: '',
      physicalAddress: '',
      signageCompany: '',
      signageContactName: '',
      signageContactPhone: '',
      signageContactEmail: '',
      signageAddress: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactDesignation: '',
      contacts: [],
      marketingCoordinatorEmail: '',
    });
  }

  async function handleUpdate(id: string, e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);

    if (!editData.name || !editData.province || !editData.town || !editData.physicalAddress) {
      setError('Name, province, town, and physical address are required');
      return;
    }

    try {
      setSaving(true);
      await updateBranch(id, {
        name: formatBranchName(editData.division, editData.name),
        division: editData.division,
        province: editData.province,
        city: null,
        town: editData.town,
        physicalAddress: editData.physicalAddress,
        signageCompany: editData.signageCompany.trim() || null,
        signageContactName: editData.signageContactName.trim() || null,
        signageContactPhone: editData.signageContactPhone.trim() || null,
        signageContactEmail: editData.signageContactEmail.trim() || null,
        signageAddress: editData.signageAddress.trim() || null,
        contactName: editData.contactName.trim() || null,
        contactEmail: editData.contactEmail.trim() || null,
        contactPhone: editData.contactPhone.trim() || null,
        contacts: [
          ...(editData.contactName.trim() ? [{
            name: editData.contactName.trim(),
            email: editData.contactEmail.trim() || undefined,
            phone: editData.contactPhone.trim() || undefined,
            designation: editData.contactDesignation.trim() || 'Contact Person',
          }] : []),
          ...editData.contacts.filter((contact) => contact.name.trim()),
        ],
        marketingCoordinatorName: editData.marketingCoordinatorEmail ? users.find((item) => item.email === editData.marketingCoordinatorEmail)?.name ?? null : null,
        marketingCoordinatorEmail: editData.marketingCoordinatorEmail || null,
      });

      const updatedName = editData.name;
      cancelEdit();
      setError(null);
      setSuccessMessage(`Branch \"${updatedName}\" was updated successfully.`);
      showSuccess('Branch updated.');
      await loadBranches();
    } catch (err) {
      setSuccessMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to update branch');
    } finally {
      setSaving(false);
    }
  }

  async function executeDelete(id: string) {
    try {
      setSaving(true);
      setSuccessMessage(null);
      const deletedBranchName = pendingDeleteBranch?.name;
      await deleteBranch(id);
      setPendingDeleteBranch(null);
      setError(null);
      if (deletedBranchName) {
        setSuccessMessage(`Branch \"${deletedBranchName}\" was removed successfully.`);
      }
      showSuccess('Branch removed.');
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await loadBranches();
    } catch (err) {
      setSuccessMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to delete branch');
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(branch: Branch) {
    setPendingDeleteBranch(branch);
  }

  function cancelDelete() {
    setPendingDeleteBranch(null);
  }

  async function confirmDeleteStep() {
    if (!pendingDeleteBranch) {
      return;
    }

    await executeDelete(pendingDeleteBranch.id);
  }

  const openProjectsByBranch = useMemo(() => {
    return projects.reduce<Record<string, Project[]>>((acc, project) => {
      if (project.status === 'completed' || project.status === 'cancelled') {
        return acc;
      }

      const branchIdKey = project.branchId?.trim().toLowerCase();
      const branchNameKey = project.branch?.trim().toLowerCase();
      if (!branchIdKey && !branchNameKey) {
        return acc;
      }

      if (branchIdKey) {
        if (!acc[branchIdKey]) {
          acc[branchIdKey] = [];
        }
        acc[branchIdKey].push(project);
      }

      if (branchNameKey && branchNameKey !== branchIdKey) {
        if (!acc[branchNameKey]) {
          acc[branchNameKey] = [];
        }
        acc[branchNameKey].push(project);
      }

      return acc;
    }, {});
  }, [projects]);

  function getOpenProjectsForBranch(branch: Branch) {
    const branchKey = (branch.id ?? '').trim().toLowerCase();
    const directMatches = openProjectsByBranch[branchKey] ?? [];

    if (directMatches.length > 0) {
      return directMatches;
    }

    return openProjectsByBranch[(branch.name ?? '').trim().toLowerCase()] ?? [];
  }

  const filteredBranches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let results = branches;

    if (query) {
      results = results.filter((branch) => {
        return [branch.name ?? '', branch.division ?? '', branch.province ?? '', branch.town ?? '', branch.physicalAddress ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
    }

    // sort: branches with active (open) projects first, then alphabetically
    return [...results].sort((a, b) => {
      const aHas = getOpenProjectsForBranch(a).length > 0;
      const bHas = getOpenProjectsForBranch(b).length > 0;

      if (aHas !== bHas) {
        return aHas ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [branches, searchTerm, projects]);

  useEffect(() => {
    if (!location.hash || filteredBranches.length === 0) {
      return;
    }

    const anchorId = location.hash.slice(1);
    if (!anchorId) {
      return;
    }

    requestAnimationFrame(() => {
      const element = document.getElementById(anchorId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [location.hash, filteredBranches]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editBranchId = params.get('editBranch');
    if (!editBranchId || filteredBranches.length === 0) {
      return;
    }

    const branchToEdit = filteredBranches.find((branch) => branch.id === editBranchId);
    if (!branchToEdit) {
      return;
    }

    beginEdit(branchToEdit);
  }, [location.search, filteredBranches]);

  useEffect(() => {
    if (loading || hasAutoRefreshed) {
      return;
    }

    const shouldRefresh = branches.length === 0 && !error && !searchTerm && !showForm;
    if (!shouldRefresh) {
      return;
    }

    setHasAutoRefreshed(true);
    console.warn('Branches page detected an empty list on load. Refreshing once.');
    void loadPageData();
  }, [branches.length, error, hasAutoRefreshed, loading, searchTerm, showForm]);

  return (
    <div className="branches-page min-h-screen rounded-[2rem] bg-slate-950 p-6 text-slate-100 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowForm(!showForm); }}
              className="rounded-xl border border-sky-300/35 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
            >
              {showForm ? 'Cancel' : 'Add Branch'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100">
            {successMessage}
          </div>
        )}

        {showForm && isAdmin && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-soft">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., Jan Kemp Dorp (will be saved as PSG Wealth Jan Kemp Dorp)"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Division *</label>
                <select
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value as Division })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  required
                >
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Province *</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., Gauteng"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Town *</label>
                <input
                  type="text"
                  value={formData.town}
                  onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., Johannesburg"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-300">Physical Address *</label>
              <input
                type="text"
                value={formData.physicalAddress}
                onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                placeholder="Full address for map location"
                required
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-300">Signage company</label>
              <input
                type="text"
                value={formData.signageCompany}
                onChange={(e) => setFormData({ ...formData, signageCompany: e.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                placeholder="Company handling this branch rebrand"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-300">Signage supplier address</label>
              <input type="text" value={formData.signageAddress} onChange={(e) => setFormData({ ...formData, signageAddress: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50" placeholder="Supplier physical address" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Contact Name</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., Jane Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Contact Email</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="name@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Contact Phone</label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., +27 82 000 0000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white">Contact Person designation</label>
                <input
                  type="text"
                  value={formData.contactDesignation}
                  onChange={(e) => setFormData({ ...formData, contactDesignation: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="e.g., Branch Manager"
                />
              </div>
            </div>

            <ParticipantFields contacts={formData.contacts} onChange={(contacts) => setFormData({ ...formData, contacts })} />

            <label className="mb-6 grid gap-2 text-sm font-medium text-slate-300">
              Marketing coordinator
              <select
                value={formData.marketingCoordinatorEmail}
                onChange={(event) => setFormData({ ...formData, marketingCoordinatorEmail: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
              >
                <option value="">Unassigned</option>
                {users.filter((item) => item.role === 'psg_user').map((item) => (
                  <option key={item.email} value={item.email}>{item.name} · {item.email}</option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Create Branch'}
            </button>
          </form>
        )}

        <div className="mb-6 rounded-3xl border border-white/10 bg-slate-950/50 p-4 shadow-soft">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by branch name, town, or address"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white placeholder:text-slate-300 outline-none focus:border-sky-400/50"
            />
          </div>
          <div className="mt-4 text-sm text-slate-400">Showing {filteredBranches.length} of {branches.length} branches</div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
            </div>
            <p className="mt-4 text-slate-400">Loading branches...</p>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 py-12 text-center">
            <p className="text-slate-300">No branches match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBranches.map((branch) => {
              const isEditing = editingBranchId === branch.id;
              const openProjects = getOpenProjectsForBranch(branch);
              const primaryContact = getBranchPrimaryContact(branch);

              if (isEditing && isAdmin) {
                return (
                  <form
                    key={branch.id}
                    onSubmit={(e) => handleUpdate(branch.id, e)}
                    className="rounded-3xl border border-sky-400/25 bg-sky-500/10 p-5"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Branch name"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        required
                      />
                      <select
                        value={editData.division}
                        onChange={(e) => setEditData({ ...editData, division: e.target.value as Division })}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        required
                      >
                        {divisions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editData.province}
                        onChange={(e) => setEditData({ ...editData, province: e.target.value })}
                        placeholder="Province"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        required
                      />
                      <input
                        type="text"
                        value={editData.town}
                        onChange={(e) => setEditData({ ...editData, town: e.target.value })}
                        placeholder="Town"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        required
                      />
                    </div>

                    <div className="mt-4">
                      <input
                        type="text"
                        value={editData.physicalAddress}
                        onChange={(e) => setEditData({ ...editData, physicalAddress: e.target.value })}
                        placeholder="Physical address"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                        required
                      />
                    </div>

                    <div className="mt-4">
                      <input
                        type="text"
                        value={editData.signageCompany}
                        onChange={(e) => setEditData({ ...editData, signageCompany: e.target.value })}
                        placeholder="Signage company handling this rebrand"
                        aria-label="Signage company"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                    </div>

                    <div className="mt-4">
                      <input type="text" value={editData.signageAddress} onChange={(e) => setEditData({ ...editData, signageAddress: e.target.value })} placeholder="Signage supplier address" aria-label="Signage supplier address" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700" />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                      <input
                        type="text"
                        value={editData.contactName}
                        onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                        placeholder="Contact name"
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <input
                        type="email"
                        value={editData.contactEmail}
                        onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                        placeholder="Contact email"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <input
                        type="text"
                        value={editData.contactPhone}
                        onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })}
                        placeholder="Contact phone"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                      <input
                        type="text"
                        value={editData.contactDesignation}
                        onChange={(e) => setEditData({ ...editData, contactDesignation: e.target.value })}
                        placeholder="Contact person designation"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
                      />
                    </div>

                    <div className="mt-4">
                      <ParticipantFields contacts={editData.contacts} onChange={(contacts) => setEditData({ ...editData, contacts })} />

                      <label className="mb-6 grid gap-2 text-sm font-medium text-slate-300">
                        Marketing coordinator
                        <select
                          value={editData.marketingCoordinatorEmail}
                          onChange={(event) => setEditData({ ...editData, marketingCoordinatorEmail: event.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                        >
                          <option value="">Unassigned</option>
                          {users.filter((item) => item.role === 'psg_user').map((item) => (
                            <option key={item.email} value={item.email}>{item.name} · {item.email}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="submit"
                        className="rounded-xl bg-sky-500 px-4 py-2 text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                        className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-slate-200 transition hover:bg-slate-900"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div id={`branch-${branch.id}`} key={branch.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-start">
                    <div>
                      <p className="mt-1 text-lg font-semibold text-white">{branch.name}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Link to={openProjects[0] ? `/projects/${openProjects[0].id}` : `/branches/${branch.id}`} className="inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25">Open workspace</Link>
                        <ProjectFollowButton projectId={branch.id} legacyProjectIds={openProjects.map((project) => project.id)} userEmail={user?.email} userRole={user?.role} noun="branch" />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{formatBranchLocation(branch.town, branch.province)}</p>
                      <p className="mt-2 text-sm text-slate-300">{branch.physicalAddress}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Division</p>
                      <span className="mt-1 inline-block rounded-full bg-sky-400/20 px-3 py-1 text-sm font-medium text-sky-200 ring-1 ring-sky-300/20">
                        {branch.division}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
                      <p className="mt-1 text-sm text-slate-300">{primaryContact?.name || 'Not set'}</p>
                      {primaryContact?.designation ? <p className="text-xs text-slate-400">{primaryContact.designation}</p> : null}
                      {primaryContact?.email ? <p className="text-xs text-slate-400">{primaryContact.email}</p> : null}
                      {primaryContact?.phone ? <p className="text-xs text-slate-400">{primaryContact.phone}</p> : null}
                    </div>

                    <div>
                      {getOpenProjectsForBranch(branch).length > 0 ? (
                        <span className="inline-flex rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 ring-1 ring-white/10">
                          {getOpenProjectsForBranch(branch).length === 1 ? 'Rebrand workspace active' : `${getOpenProjectsForBranch(branch).length} rebrand workspaces active`}
                        </span>
                      ) : <span className="text-xs text-slate-500">Create a new branch to start another project</span>}
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

        {pendingDeleteBranch ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-red-400/25 bg-slate-950 p-6 shadow-xl">
              <h3 className="text-xl font-semibold text-white">Confirm branch removal</h3>
              <p className="mt-2 text-sm text-slate-300">
                You are about to remove <span className="font-semibold">{pendingDeleteBranch.name}</span>.
              </p>
              <p className="mt-1 text-sm text-slate-400">
                This action cannot be undone.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); confirmDeleteStep(); }}
                  className="rounded-xl border border-red-400/30 bg-red-600 px-4 py-2 text-white transition hover:bg-red-500 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Removing...' : 'Yes, remove branch'}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cancelDelete(); }}
                  className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-slate-200 transition hover:bg-slate-900"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
