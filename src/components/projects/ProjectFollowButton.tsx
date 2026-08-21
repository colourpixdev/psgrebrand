import { useEffect, useState } from 'react';
import { getFollowChangedEventName, getFollowedProjectIds, toggleFollowedProject } from '../../services/projectFollowService';

export function ProjectFollowButton({ projectId, userEmail }: { projectId: string; userEmail?: string }) {
  const [isFollowed, setIsFollowed] = useState(() => getFollowedProjectIds(userEmail).includes(projectId));

  useEffect(() => {
    const refresh = () => setIsFollowed(getFollowedProjectIds(userEmail).includes(projectId));
    window.addEventListener(getFollowChangedEventName(), refresh);
    return () => window.removeEventListener(getFollowChangedEventName(), refresh);
  }, [projectId, userEmail]);

  return (
    <button
      type="button"
      aria-pressed={isFollowed}
      aria-label={isFollowed ? 'Remove project from dashboard' : 'Add project to dashboard'}
      onClick={(event) => {
        event.stopPropagation();
        setIsFollowed(toggleFollowedProject(userEmail, projectId));
      }}
      className={`font-medium transition ${isFollowed ? 'text-amber-700 hover:text-amber-800' : 'text-slate-600 hover:text-sky-700'}`}
    >
      {isFollowed ? 'Following' : 'Follow'}
    </button>
  );
}
