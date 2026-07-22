import React, { useEffect, useState } from 'react';
import { getAllBranches, createBranch, deleteBranch } from '../services/branchService';
import type { Branch, Division } from '../types/domain';
import { useAuth } from '../contexts/AuthContext';

const divisions: Division[] = ['Wealth', 'Insure', 'Wealth Insure', 'Asset', 'Trust'];

export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    division: 'Wealth' as Division,
    province: '',
    town: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
  });
  const { user } = useAuth();

  const isAdmin = user?.role === 'colourpix_admin';

  useEffect(() => {
    loadBranches();
  }, []);

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
    if (!formData.name || !formData.province || !formData.town || !formData.physicalAddress) {
      setError('Name, province, town, and physical address are required');
      return;
    }

    try {
      await createBranch({
        name: formData.name,
        division: formData.division,
        province: formData.province,
        town: formData.town,
        physicalAddress: formData.physicalAddress,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      });

      setFormData({
        name: '',
        division: 'Wealth',
        province: '',
        town: '',
        physicalAddress: '',
        latitude: '',
        longitude: '',
      });
      setShowForm(false);
      setError(null);
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this branch?')) return;

    try {
      await deleteBranch(id);
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Branches</h1>
            <p className="text-slate-600">Manage divisions and branch locations</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {showForm ? 'Cancel' : 'Add Branch'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {showForm && isAdmin && (
          <form onSubmit={handleSubmit} className="mb-8 bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Johannesburg Branch"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Division *</label>
                <select
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value as Division })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Province *</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Gauteng"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Town *</label>
                <input
                  type="text"
                  value={formData.town}
                  onChange={(e) => setFormData({ ...formData, town: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Johannesburg"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Physical Address *</label>
              <input
                type="text"
                value={formData.physicalAddress}
                onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full address for map location"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-90 to 90"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-180 to 180"
                />
              </div>
            </div>

            <button type="submit" className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              Create Branch
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
            </div>
            <p className="mt-4 text-slate-600">Loading branches...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-600">No branches yet. {isAdmin && 'Click "Add Branch" to create one.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <div key={branch.id} className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden hover:shadow-lg transition">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-slate-900">{branch.name}</h3>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(branch.id)}
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {branch.division}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-slate-600">Address</p>
                      <p className="text-slate-900 font-medium">{branch.physicalAddress}</p>
                    </div>
                    {branch.latitude && branch.longitude && (
                      <div>
                        <p className="text-slate-600">Coordinates</p>
                        <p className="text-slate-900 font-mono text-xs">
                          {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-600 text-xs">Created {new Date(branch.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
