import { useState } from 'react';
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

function canPreviewFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

export function FileGrid({
  files,
  taskFolders = [],
  isUploading,
  uploadError,
  canUpload = true,
  onPreview,
  onDownload,
  onRename,
  onUpload,
}: {
  files: ProjectFile[];
  taskFolders?: Array<{ id: string; label: string }>;
  isUploading?: boolean;
  uploadError?: string | null;
  canUpload?: boolean;
  onPreview?: (file: ProjectFile) => void;
  onDownload?: (file: ProjectFile) => void;
  onRename?: (file: ProjectFile, nextName: string) => void;
  onUpload?: (file: File, taskId?: string) => void;
}) {
  const [renamingFileKey, setRenamingFileKey] = useState<string | null>(null);
  const [nextFileName, setNextFileName] = useState('');
  const [openFolderIds, setOpenFolderIds] = useState<string[]>([]);

  const rootFiles = files.filter((file) => !file.taskId);
  const folders = taskFolders
    .map((folder) => ({ ...folder, files: files.filter((file) => file.taskId === folder.id) }))
    .filter((folder) => folder.files.length > 0);

  function renderFileCard(file: ProjectFile) {
    const key = file.path ?? file.name;

    return (
      <div key={`${key}-${file.uploadedAt ?? ''}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
        </div>
        {file.path ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {canPreviewFile(file) ? (
              <button type="button" onClick={() => onPreview?.(file)} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
                Preview
              </button>
            ) : null}
            <button type="button" onClick={() => onDownload?.(file)} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
              Download
            </button>
            <button type="button" onClick={() => { setRenamingFileKey(key); setNextFileName(file.name); }} className="text-xs font-semibold text-sky-200 transition hover:text-sky-100">
              Rename
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Legacy file name only</p>
        )}
        {renamingFileKey === key ? (
          <div className="mt-3 grid gap-2">
            <input value={nextFileName} onChange={(event) => setNextFileName(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/50" />
            <div className="flex gap-2">
              <button type="button" disabled={!nextFileName.trim()} onClick={() => { onRename?.(file, nextFileName); setRenamingFileKey(null); }} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setRenamingFileKey(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Files</h3>
          <p className="mt-1 text-sm text-slate-400">Upload artwork, quotes, POs, measurements, and install photos. Files uploaded from a task are grouped into that task's folder below.</p>
        </div>
        {canUpload ? (
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload file'}
            <input
              type="file"
              disabled={isUploading}
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.ai"
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

      {folders.length > 0 ? (
        <div className="mt-4 space-y-3">
          {folders.map((folder) => {
            const isOpen = openFolderIds.includes(folder.id);

            return (
              <div key={folder.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <button
                  type="button"
                  onClick={() => setOpenFolderIds((current) => (isOpen ? current.filter((id) => id !== folder.id) : [...current, folder.id]))}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <FileText className="h-4 w-4 shrink-0 text-amber-200" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{folder.label}</span>
                  <span className="shrink-0 text-xs text-slate-400">{folder.files.length} file{folder.files.length === 1 ? '' : 's'}</span>
                </button>
                {isOpen ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {folder.files.map((file) => renderFileCard(file))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rootFiles.length > 0 ? rootFiles.map((file) => renderFileCard(file)) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-slate-400 sm:col-span-2">
            {folders.length > 0 ? 'No general files uploaded yet.' : 'No files uploaded yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
