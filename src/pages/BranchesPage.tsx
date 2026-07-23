import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllBranches, createBranch, updateBranch, deleteBranch } from '../services/branchService';
import { getProjects } from '../services/portalService';
import type { Branch, Division, Project } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';
import { filterProjectsForUser } from '../utils/permissions';

const divisions: Division[] = ['Wealth', 'Insure', 'Wealth Insure', 'Asset', 'Trust'];

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
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(1);
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
  });
  const { user } = useAuth();

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
        town: formData.town,
        physicalAddress: formData.physicalAddress,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        contactName: formData.contactName.trim() || null,
        contactEmail: formData.contactEmail.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
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
      });
      setShowForm(false);
      setError(null);
      setSuccessMessage(`Branch \"${formData.name}\" was created successfully.`);
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
    setEditData({
      name: branch.name,
      division: branch.division,
      province: branch.province,
      town: branch.town,
      physicalAddress: branch.physicalAddress,
      latitude: branch.latitude?.toString() ?? '',
      longitude: branch.longitude?.toString() ?? '',
      contactName: branch.contactName ?? '',
      contactEmail: branch.contactEmail ?? '',
      contactPhone: branch.contactPhone ?? '',
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
        town: editData.town,
        physicalAddress: editData.physicalAddress,
        latitude: editData.latitude ? parseFloat(editData.latitude) : null,
        longitude: editData.longitude ? parseFloat(editData.longitude) : null,
        contactName: editData.contactName.trim() || null,
        contactEmail: editData.contactEmail.trim() || null,
        contactPhone: editData.contactPhone.trim() || null,
      });

      const updatedName = editData.name;
      cancelEdit();
      setError(null);
      setSuccessMessage(`Branch \"${updatedName}\" was updated successfully.`);
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
      setDeleteConfirmCount(1);
      setError(null);
      if (deletedBranchName) {
        setSuccessMessage(`Branch \"${deletedBranchName}\" was removed successfully.`);
      }
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
    setDeleteConfirmCount(1);
  }

  function cancelDelete() {
    setPendingDeleteBranch(null);
    setDeleteConfirmCount(1);
  }

  async function confirmDeleteStep() {
    if (!pendingDeleteBranch) {
      return;
    }

    if (deleteConfirmCount < 3) {
      setDeleteConfirmCount((count) => count + 1);
      return;
    }

    await executeDelete(pendingDeleteBranch.id);
  }

  const filteredBranches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return branches;
    }

    return branches.filter((branch) => {
      return [branch.name, branch.division, branch.province, branch.town, branch.physicalAddress]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
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
            <h1 className="text-4xl font-bold text-white mb-2">Branches</h1>
            <p className="text-slate-400">Manage divisions and branch locations</p>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            </div>

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
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, division, province, town, or address"
              className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-white placeholder:text-slate-500 outline-none focus:border-sky-400/50"
            />
            <p className="text-sm text-slate-400">Showing {filteredBranches.length} of {branches.length} branches</p>
          </div>
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

              if (isEditing && isAdmin) {
                return (
                  <form
                    key={branch.id}
                    onSubmit={(e) => handleUpdate(branch.id, e)}
                    className="rounded-3xl border border-sky-400/25 bg-sky-500/10 p-5"
                  >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
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
                <div key={branch.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-soft">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_1fr_auto] lg:items-start">
                    <div>
                      <p className="text-lg font-semibold text-white">{branch.name}</p>
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
                      <p className="mt-1 text-sm text-slate-300">{branch.contactName || 'Not set'}</p>
                      {branch.contactEmail ? <p className="text-xs text-slate-400">{branch.contactEmail}</p> : null}
                      {branch.contactPhone ? <p className="text-xs text-slate-400">{branch.contactPhone}</p> : null}
                    </div>

                    {isAdmin ? (
                      <div className="flex gap-2 lg:justify-end">
                        <Link
                          to={`/projects?branchId=${encodeURIComponent(branch.id)}`}
                          className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          Add Project
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
                        <p className="text-xs uppercase tracking-wide text-slate-500">Open Projects</p>
                        <span className="rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                          {openProjects.length}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {openProjects.map((project) => (
                          <Link
                            key={project.id}
                            to={`/projects/${project.id}`}
                            className="block rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 transition hover:border-sky-300/40 hover:bg-slate-900"
                          >
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
                          </Link>
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
                To avoid accidental deletion, click <span className="font-semibold">Yes</span> three times.
              </p>
              <p className="mt-3 text-sm text-red-300">Confirmation step: {deleteConfirmCount} of 3</p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={confirmDeleteStep}
                  className="rounded-xl border border-red-400/30 bg-red-600 px-4 py-2 text-white transition hover:bg-red-500 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Removing...' : `Yes (${deleteConfirmCount}/3)`}
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
