import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllBranches, createBranch, updateBranch, deleteBranch } from '../services/branchService';
import { getProjects } from '../services/portalService';
import type { Branch, ContactPerson, Division, Project } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';
import { useSaveFeedback } from '../contexts/SaveFeedbackContext';
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
          <p className="text-sm font-medium text-slate-200">Additional contact persons</p>
          <p className="mt-1 text-xs text-slate-500">Add other contact persons and their designations.</p>
        </div>
        <button type="button" onClick={() => onChange([...contacts, { name: '', email: '', phone: '', designation: '' }])} className="rounded-xl border border-sky-400/30 px-3 py-2 text-sm text-sky-200 transition hover:bg-sky-400/10">Add contact person</button>
      </div>
      <div className="mt-3 space-y-3">
        {contacts.map((contact, index) => (
          <div key={`${contact.email}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <input type="text" value={contact.name} onChange={(event) => updateContact(index, 'name', event.target.value)} placeholder="Name" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="text" value={contact.designation} onChange={(event) => updateContact(index, 'designation', event.target.value)} placeholder="Designation" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="email" value={contact.email ?? ''} onChange={(event) => updateContact(index, 'email', event.target.value)} placeholder="Email" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <input type="text" value={contact.phone ?? ''} onChange={(event) => updateContact(index, 'phone', event.target.value)} placeholder="Phone" className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white" />
            <button type="button" onClick={() => onChange(contacts.filter((_, contactIndex) => contactIndex !== index))} className="text-sm text-red-200 transition hover:text-red-100">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [pendingDeleteBranch, setPendingDeleteBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    division: 'Wealth' as Division,
    province: '',
    town: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    contacts: [] as ContactPerson[],
  });
  const [editData, setEditData] = useState({
    name: '',
    division: 'Wealth' as Division,
    province: '',
    town: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
    contacts: [] as ContactPerson[],
  });
  const { user } = useAuth();
  const { showSuccess } = useSaveFeedback();

  const isAdmin = user?.role === 'colourpix_admin';

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(filterProjectsForUser(data, user));
    } catch (err) {
      console.error('Failed to load projects for branches page:', err);
    }
  }

  async function loadPageData() {
    setLoading(true);
    setError(null);
    try {
      const [branchData, projectData] = await Promise.all([getAllBranches(), getProjects()]);
      setBranches(branchData);
      setProjects(filterProjectsForUser(projectData, user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches');
    } finally {
      setLoading(false);
    }
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
      await createBranch({
        name: formData.name,
        division: formData.division,
        province: formData.province,
        city: null,
        town: formData.town,
        physicalAddress: formData.physicalAddress,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
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
      });

      setFormData({
        name: '',
        division: 'Wealth',
        province: '',
        town: '',
        physicalAddress: '',
        latitude: '',
        longitude: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        contactDesignation: '',
        contacts: [],
      });
      setShowForm(false);
      setError(null);
      setSuccessMessage(`Branch \"${formData.name}\" was created successfully.`);
      showSuccess('Branch saved.');
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
      name: branch.name,
      division: branch.division,
      province: branch.province,
      town: branch.town,
      physicalAddress: branch.physicalAddress,
      latitude: branch.latitude?.toString() ?? '',
      longitude: branch.longitude?.toString() ?? '',
      contactName: primaryContact?.name ?? branch.contactName ?? '',
      contactEmail: primaryContact?.email ?? branch.contactEmail ?? '',
      contactPhone: primaryContact?.phone ?? branch.contactPhone ?? '',
      contactDesignation: primaryContact?.designation ?? '',
      contacts: getAdditionalBranchContacts(branch),
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
      latitude: '',
      longitude: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      contactDesignation: '',
      contacts: [],
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
        name: editData.name,
        division: editData.division,
        province: editData.province,
        city: null,
        town: editData.town,
        physicalAddress: editData.physicalAddress,
        latitude: editData.latitude ? parseFloat(editData.latitude) : null,
        longitude: editData.longitude ? parseFloat(editData.longitude) : null,
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

  const filteredBranches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let results = branches;

    if (query) {
      results = results.filter((branch) => {
        return [branch.name, branch.division, branch.province, branch.town, branch.physicalAddress]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
    }

    return [...results].sort((a, b) => a.name.localeCompare(b.name));
  }, [branches, searchTerm]);

  const openProjectsByBranch = useMemo(() => {
    return projects.reduce<Record<string, Project[]>>((acc, project) => {
      if (project.status === 'completed' || project.status === 'cancelled') {
        return acc;
      }

      const branchKey = project.branchId?.trim() || project.branch.trim().toLowerCase();
      if (!branchKey) {
        return acc;
      }

      if (!acc[branchKey]) {
        acc[branchKey] = [];
      }

      acc[branchKey].push(project);
      return acc;
    }, {});
  }, [projects]);

  function getOpenProjectsForBranch(branch: Branch) {
    const directMatches = openProjectsByBranch[branch.id] ?? [];

    if (directMatches.length > 0) {
      return directMatches;
    }

    return openProjectsByBranch[branch.name.trim().toLowerCase()] ?? [];
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Branch Rebrand Projects</h1>
            <p className="text-slate-400">List of PSG branches in South Africa and Namibia. Each branch is managed as a rebrand project.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-2xl bg-sky-500 px-6 py-3 text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                  placeholder="e.g., Johannesburg Branch"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="-90 to 90"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white outline-none focus:border-sky-400/50"
                  placeholder="-180 to 180"
                />
              </div>
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
                <label className="mb-1 block text-sm font-medium text-slate-300">Contact Person designation</label>
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
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white placeholder:text-slate-500 outline-none focus:border-sky-400/50"
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
            <p className="text-slate-400">No branches match your search.</p>
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
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                        required
                      />
                      <select
                        value={editData.division}
                        onChange={(e) => setEditData({ ...editData, division: e.target.value as Division })}
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
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
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                        required
                      />
                      <input
                        type="text"
                        value={editData.town}
                        onChange={(e) => setEditData({ ...editData, town: e.target.value })}
                        placeholder="Town"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                        required
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px_180px]">
                      <input
                        type="text"
                        value={editData.physicalAddress}
                        onChange={(e) => setEditData({ ...editData, physicalAddress: e.target.value })}
                        placeholder="Physical address"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                        required
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={editData.latitude}
                        onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                        placeholder="Latitude"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={editData.longitude}
                        onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                        placeholder="Longitude"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                      <input
                        type="text"
                        value={editData.contactName}
                        onChange={(e) => setEditData({ ...editData, contactName: e.target.value })}
                        placeholder="Contact name"
                        className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white"
                      />
                      <input
                        type="email"
                        value={editData.contactEmail}
                        onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })}
                        placeholder="Contact email"
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                      <input
                        type="text"
                        value={editData.contactPhone}
                        onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })}
                        placeholder="Contact phone"
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                      <input
                        type="text"
                        value={editData.contactDesignation}
                        onChange={(e) => setEditData({ ...editData, contactDesignation: e.target.value })}
                        placeholder="Contact person designation"
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>

                    <div className="mt-4">
                      <ParticipantFields contacts={editData.contacts} onChange={(contacts) => setEditData({ ...editData, contacts })} />
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
                        onClick={cancelEdit}
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
                      <Link to={`/branches/${branch.id}`} className="mt-3 inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25">Open branch project</Link>
                      <p className="mt-1 text-sm text-slate-400">{branch.town}, {branch.province}</p>
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

                    {isAdmin ? (
                      <div className="flex gap-2 lg:justify-end">
                        <Link
                          to={`/branches/${encodeURIComponent(branch.id)}`}
                          className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          Open branch record
                        </Link>
                        <button
                          type="button"
                          onClick={() => beginEdit(branch)}
                          className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
                          disabled={saving}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(branch)}
                          className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/20"
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {openProjects.length > 0 ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Open rebrand updates</p>
                        <span className="rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                          {openProjects.length}
                        </span>
                      </div>

                      <div className="mt-3">
                        <Link to={`/branches/${branch.id}`} className="inline-flex items-center justify-center rounded-xl border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 transition hover:bg-sky-400/25">View branch details</Link>
                      </div>

                      <div className="mt-3 space-y-2">
                        {openProjects.map((project) => (
                          <div key={project.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{project.id}</p>
                                <p className="truncate text-xs text-slate-400">
                                  {project.currentStage} · {project.town}, {project.province}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-sky-400/20 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-200 ring-1 ring-sky-300/20">
                                {project.status.replace('_', ' ')}
                              </span>
                            </div>
                            <Link to={`/branches/${encodeURIComponent(branch.id)}`} className="mt-2 inline-flex items-center justify-center rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-400/25">Open branch hub</Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                  onClick={confirmDeleteStep}
                  className="rounded-xl border border-red-400/30 bg-red-600 px-4 py-2 text-white transition hover:bg-red-500 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Removing...' : 'Yes, remove branch'}
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
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
