export function FileGrid({ files }: { files: string[] }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-white">Files</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {files.map((file) => (
          <div key={file} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
            {file}
          </div>
        ))}
      </div>
    </div>
  );
}
