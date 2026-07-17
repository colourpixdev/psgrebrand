export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-5 shadow-soft">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}
