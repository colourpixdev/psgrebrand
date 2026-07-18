import { FileText } from 'lucide-react';
import type { ProjectFile } from '../../types/domain';

function formatFileSize(size?: number) {
  if (!size) {
    return 'Stored record';
  }

  if (size < 1024 * 1024) {
    return size < 1024 ? '<1 KB' : `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function FileGrid({
  files,
  isUploading,
  uploadError,
  canUpload = true,
  onDownload,
  onUpload,
}: {
  files: ProjectFile[];
  isUploading?: boolean;
  uploadError?: string | null;
  canUpload?: boolean;
  onDownload?: (file: ProjectFile) => void;
  onUpload?: (file: File) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Files</h3>
          <p className="mt-1 text-sm text-slate-400">Upload artwork, quotes, POs, measurements, and install photos.</p>
        </div>
        {canUpload ? (
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload file'}
            <input
              type="file"
              disabled={isUploading}
              accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  onUpload?.(file);
                }
              }}
            />
          </label>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">View only</p>
        )}
      </div>

      {uploadError ? <p className="mt-3 text-sm text-red-300">{uploadError}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {files.length > 0 ? files.map((file) => (
          <div key={`${file.path ?? file.name}-${file.uploadedAt ?? ''}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            {file.path ? (
              <button type="button" onClick={() => onDownload?.(file)} className="mt-3 text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                Download
              </button>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Legacy file name only</p>
            )}
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-slate-400 sm:col-span-2">
            No files uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}
