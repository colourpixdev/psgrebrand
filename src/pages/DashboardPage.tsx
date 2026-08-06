import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getAllBranches } from '../services/branchService';
import { useAuth } from '../contexts/AuthContext';


function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quickSearch, setQuickSearch] = useState('');
  const {
    data: branches = [],
    isLoading: isLoadingBranches,
    isError: isBranchesError,
    error: branchesError,
  } = useQuery({ queryKey: ['branches'], queryFn: getAllBranches });
  const isLoading = isLoadingBranches;
  const loadError = isBranchesError ? branchesError : null;

  function submitQuickSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(quickSearch.trim())}`);
  }

  return (
    <div className="space-y-6">
      <section className="border-b border-white/10 pb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">PSG Branch Rebrand</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h2>
            <p className="mt-2 text-sm text-slate-400">Track PSG branch rebrand progress across South Africa and Namibia.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-slate-400">Metrics are scoped to your assigned branches.</p>
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-100">
          Error loading dashboard: {String((loadError as any)?.message ?? loadError)}
        </div>
      ) : null}

      <form onSubmit={submitQuickSearch} className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className="flex items-center gap-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            value={quickSearch}
            onChange={(event) => setQuickSearch(event.target.value)}
            placeholder="Search any branch..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
      </form>
    </div>
  );
}
