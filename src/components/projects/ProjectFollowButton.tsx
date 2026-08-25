import { useEffect, useState } from 'react';
import { getFollowChangedEventName, getFollowedProjectIds, toggleFollowedProject } from '../../services/projectFollowService';

export function ProjectFollowButton({ projectId, userEmail, noun = 'project', unfollowOnly = false }: { projectId: string; userEmail?: string; noun?: 'project' | 'branch'; unfollowOnly?: boolean }) {
  const [isFollowed, setIsFollowed] = useState(() => getFollowedProjectIds(userEmail).includes(projectId));

  useEffect(() => {
    const refresh = () => setIsFollowed(getFollowedProjectIds(userEmail).includes(projectId));
    window.addEventListener(getFollowChangedEventName(), refresh);
    return () => window.removeEventListener(getFollowChangedEventName(), refresh);
  }, [projectId, userEmail]);

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
        setIsFollowed(toggleFollowedProject(userEmail, projectId));
      }}
      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${unfollowOnly ? 'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50' : isFollowed ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-slate-300 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'}`}
    >
      {unfollowOnly ? 'Unfollow' : isFollowed ? (noun === 'branch' ? 'Tracking branch' : 'Following') : (noun === 'branch' ? 'Track branch' : 'Follow')}
    </button>
  );
}
