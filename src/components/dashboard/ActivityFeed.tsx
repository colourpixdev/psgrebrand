import type { ActivityItem } from '../../types/domain';

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={`${item.title}-${item.date}`} className="flex gap-3">
            <span
              className={`mt-2 h-2.5 w-2.5 rounded-full ${
                item.type === 'success'
                  ? 'bg-emerald-400'
                  : item.type === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
              }`}
            />
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-sm text-slate-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
