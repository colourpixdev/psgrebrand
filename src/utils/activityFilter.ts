import type { ActivityItem } from '../types/domain';

export function filterActivityExcludingUser(items: ActivityItem[], userName?: string) {
  if (!userName) return items;
  const normalized = userName.trim().toLowerCase();
  return items.filter((item) => {
    const title = (item.title ?? '').toLowerCase();
    const detail = (item.detail ?? '').toLowerCase();
    return !title.includes(normalized) && !detail.includes(normalized);
  });
}
