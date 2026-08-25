import { useEffect, useState } from 'react';
import { getFollowChangedEventName, getFollowedProjectIds, syncFollowedProjects, toggleFollowedProject } from '../../services/projectFollowService';
import { canManageFollowedBranches } from '../../constants/workspaces';

export function ProjectFollowButton({ projectId, legacyProjectIds = [], userEmail, userRole, noun = 'project', unfollowOnly = false }: { projectId: string; legacyProjectIds?: string[]; userEmail?: string; userRole?: string; noun?: 'project' | 'branch'; unfollowOnly?: boolean }) {
  const canManageFollowedBranchesForUser = canManageFollowedBranches(userEmail, userRole);
  const isTracked = (ids: string[]) => ids.some((id) => getFollowedProjectIds(userEmail).includes(id));
  const [isFollowed, setIsFollowed] = useState(() => isTracked([projectId, ...legacyProjectIds]));

  useEffect(() => {
    if (!canManageFollowedBranchesForUser) {
      return undefined;
    }

    const refresh = () => setIsFollowed(isTracked([projectId, ...legacyProjectIds]));
    void syncFollowedProjects(userEmail).then(refresh);
    window.addEventListener(getFollowChangedEventName(), refresh);
    return () => window.removeEventListener(getFollowChangedEventName(), refresh);
  }, [canManageFollowedBranchesForUser, legacyProjectIds, projectId, userEmail]);

  if (!canManageFollowedBranchesForUser) {
    return null;
  }

  if (unfollowOnly && !isFollowed) {
    return null;
  }

  return (
    <button
      type="button"
      aria-pressed={isFollowed}
      aria-label={unfollowOnly ? `Unfollow ${noun}` : isFollowed ? `Remove ${noun} from dashboard` : `Add ${noun} to dashboard`}
      onClick={(event) => {
        event.stopPropagation();
        setIsFollowed(toggleFollowedProject(userEmail, projectId, legacyProjectIds));
      }}
      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${unfollowOnly ? 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50' : isFollowed ? 'border-amber-300 bg-amber-50 !text-slate-900 hover:bg-amber-100' : 'border-slate-300 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'}`}
    >
      {unfollowOnly ? 'Unfollow' : isFollowed ? (noun === 'branch' ? 'Tracking branch' : 'Following') : (noun === 'branch' ? 'Track branch' : 'Follow')}
    </button>
  );
}
