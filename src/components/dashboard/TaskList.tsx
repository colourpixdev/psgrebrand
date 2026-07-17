export function TaskList({ tasks }: { tasks: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-white">Today's Tasks</h3>
      <ul className="mt-5 space-y-3 text-sm text-slate-200">
        {tasks.map((task) => (
          <li key={task} className="flex items-start gap-3 rounded-2xl bg-slate-950/50 px-4 py-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
            {task}
          </li>
        ))}
      </ul>
    </div>
  );
}
